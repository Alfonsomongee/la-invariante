import fs from 'node:fs';
import path from 'node:path';
import { findContentFileById, loadPrompt, readYamlFile, writeReport } from '../lib/io.js';
import { callLlm } from '../lib/llm.js';
import { validateRepository } from '../../scripts/validate.js';
import { lintDocument, loadBlacklist } from '../../scripts/estilo/lint.js';
import { etiquetaEstadoProcesal, type Ficha } from '../../scripts/lib/constants.js';

export interface JuristaArgs {
  ficha: string;
  soloReglas?: boolean;
  promptOnly?: boolean;
}

export interface JuristaResult {
  reportPath: string;
  dictamen: 'CONFORME' | 'CON_CONDICIONES' | 'NO_APTO' | 'PROMPT_ONLY';
  blockingErrors: number;
  reportMarkdown: string;
}

export function buildDeterministicLegalReport(filePath: string): {
  markdown: string;
  blockingErrors: number;
  warnings: number;
} {
  const data = readYamlFile<Record<string, unknown>>(filePath);
  const valResult = validateRepository({ files: [filePath], enforceDirectoryMatch: false });
  const lintIssues = lintDocument(filePath, data, loadBlacklist());

  const legalErrors = [
    ...valResult.errors,
    ...lintIssues.filter((i) => i.severity === 'error' && i.rule.startsWith('estilo-lexico')),
  ];
  const allWarnings = [
    ...valResult.warnings,
    ...lintIssues.filter((i) => i.severity === 'warning'),
  ];

  const protagonistas = (data.protagonistas as Array<{ nombre: string; cargo_publico: boolean }> | undefined) ?? [];
  const particulares = protagonistas.filter((p) => p.cargo_publico === false);

  const ep = data.estado_procesal as Ficha['estado_procesal'] | undefined;
  const imagen = data.imagen as Ficha['imagen'] | undefined;

  const lines: string[] = [
    '### Revisión determinista de reglas jurídicas (CLAUDE.md §5 y §8)',
    '',
    `- **Archivo:** \`${path.basename(filePath)}\``,
    ep
      ? `- **Estado procesal:** \`${ep.actual}\` → etiqueta web: *«${etiquetaEstadoProcesal(ep)}»*`
      : '- **Estado procesal:** No aplicable (promesa/votación)',
    `- **Privacidad (STC 58/2018):** ${
      particulares.length === 0
        ? 'Todos los protagonistas declarados son cargos públicos (o no constan personas físicas).'
        : `ATENCIÓN — ${particulares.length} persona(s) con \`cargo_publico: false\`: la web aplicará \`noindex\` y exclusión de Pagefind automáticamente.`
    }`,
    `- **Licencia de imagen:** ${
      imagen ? `\`${imagen.licencia}\` (autor: ${imagen.autor})` : 'Sin imagen (`imagen: null`).'
    }`,
    `- **Errores bloqueantes detectados:** ${legalErrors.length}`,
    `- **Avisos:** ${allWarnings.length}`,
    '',
  ];

  if (legalErrors.length > 0) {
    lines.push('#### Errores bloqueantes');
    for (const err of legalErrors) {
      lines.push(`- **[${err.rule}]** ${err.message}`);
    }
    lines.push('');
  }

  if (allWarnings.length > 0) {
    lines.push('#### Avisos');
    for (const w of allWarnings) {
      lines.push(`- **[${w.rule}]** ${w.message}`);
    }
    lines.push('');
  }

  return {
    markdown: lines.join('\n'),
    blockingErrors: legalErrors.length,
    warnings: allWarnings.length,
  };
}

export async function runJurista(args: JuristaArgs): Promise<JuristaResult> {
  const filePath = fs.existsSync(args.ficha)
    ? path.resolve(args.ficha)
    : findContentFileById(args.ficha);

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`No se encontró la ficha "${args.ficha}".`);
  }

  const baseId = path.basename(filePath, path.extname(filePath));
  const deterministic = buildDeterministicLegalReport(filePath);

  if (args.soloReglas) {
    const dictamen = deterministic.blockingErrors > 0 ? 'NO_APTO' : 'CONFORME';
    const reportMarkdown = `## Dictamen jurídico (solo reglas deterministas): ${dictamen}\n\n${deterministic.markdown}`;
    const reportPath = writeReport('jurista', `${baseId}.md`, reportMarkdown);
    return {
      reportPath,
      dictamen,
      blockingErrors: deterministic.blockingErrors,
      reportMarkdown,
    };
  }

  const yamlContent = fs.readFileSync(filePath, 'utf8');
  const systemPrompt = loadPrompt('jurista');
  const userPrompt = [
    `Revisa jurídicamente la ficha ${baseId}.`,
    deterministic.markdown,
    `## Ficha YAML completa\n\`\`\`yaml\n${yamlContent}\n\`\`\``,
  ].join('\n\n');

  const response = await callLlm({
    role: 'jurista',
    systemPrompt,
    userPrompt,
    promptOnly: args.promptOnly,
  });

  const reportMarkdown = [
    `<!-- Informe generado por Agente Jurista (${response.provider}:${response.model}) -->`,
    '',
    deterministic.markdown,
    '---',
    '',
    response.text,
  ].join('\n');

  const reportPath = writeReport('jurista', `${baseId}.md`, reportMarkdown);

  if (response.promptOnly) {
    return {
      reportPath,
      dictamen: 'PROMPT_ONLY',
      blockingErrors: deterministic.blockingErrors,
      reportMarkdown,
    };
  }

  // Regla dura: si las reglas deterministas fallan, el dictamen nunca puede ser CONFORME
  if (deterministic.blockingErrors > 0) {
    return {
      reportPath,
      dictamen: 'NO_APTO',
      blockingErrors: deterministic.blockingErrors,
      reportMarkdown,
    };
  }

  const match = response.text.match(/\b(NO_APTO|CON_CONDICIONES|CONFORME)\b/);
  const dictamen = (match?.[1] as JuristaResult['dictamen']) ?? 'CON_CONDICIONES';
  return {
    reportPath,
    dictamen,
    blockingErrors: deterministic.blockingErrors,
    reportMarkdown,
  };
}
