import fs from 'node:fs';
import path from 'node:path';
import {
  extractFencedBlock,
  findContentFileById,
  loadPrompt,
  readYamlFile,
  writeReport,
  writeYamlFile,
} from '../lib/io.js';
import { callLlm } from '../lib/llm.js';
import { lintDocument, loadBlacklist } from '../../scripts/estilo/lint.js';
import { validateCoberturaResumen } from '../../scripts/lib/rules.js';
import type { Cifra, Fuente, Protagonista } from '../../scripts/lib/constants.js';

export interface EditorArgs {
  ficha: string;
  promptOnly?: boolean;
  maxRetries?: number;
}

export async function runEditor(args: EditorArgs): Promise<{
  filePath: string;
  updated: boolean;
  titulo: string;
  resumen: string;
  lintErrors: number;
}> {
  const filePath = fs.existsSync(args.ficha)
    ? path.resolve(args.ficha)
    : findContentFileById(args.ficha);

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`No se encontró la ficha "${args.ficha}".`);
  }

  const data = readYamlFile<Record<string, unknown>>(filePath);
  const baseId = path.basename(filePath, path.extname(filePath));
  const blacklist = loadBlacklist();
  const systemPrompt = loadPrompt('editor');
  const maxRetries = args.maxRetries ?? 2;

  let feedback = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userPrompt = [
      `Revisa y ajusta el título y el resumen de la ficha ${baseId} para cumplir estrictamente las reglas editoriales.`,
      `## Ficha actual\n\`\`\`yaml\n${fs.readFileSync(filePath, 'utf8')}\n\`\`\``,
      feedback ? `## Errores detectados en el intento anterior (corrígelos todos)\n${feedback}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await callLlm({
      role: 'editor',
      systemPrompt,
      userPrompt,
      promptOnly: args.promptOnly,
    });

    if (response.promptOnly) {
      writeReport('editor', `prompt-${baseId}.md`, response.text);
      return {
        filePath,
        updated: false,
        titulo: String(data.titulo ?? ''),
        resumen: String(data.resumen ?? ''),
        lintErrors: 0,
      };
    }

    const jsonText = extractFencedBlock(response.text, 'json');
    const proposed = JSON.parse(jsonText) as { titulo: string; resumen: string };

    const candidate = { ...data, titulo: proposed.titulo, resumen: proposed.resumen };
    const lintIssues = lintDocument(filePath, candidate, blacklist);
    const coberturaIssues = validateCoberturaResumen(
      filePath,
      proposed.resumen,
      (data.fuentes as Fuente[]) ?? [],
      data.cifras as Cifra[] | undefined,
      data.protagonistas as Protagonista[] | undefined,
    );

    const allErrors = [...lintIssues, ...coberturaIssues].filter((i) => i.severity === 'error');
    if (allErrors.length === 0) {
      data.titulo = proposed.titulo;
      data.resumen = proposed.resumen;
      writeYamlFile(filePath, data);
      return {
        filePath,
        updated: true,
        titulo: proposed.titulo,
        resumen: proposed.resumen,
        lintErrors: 0,
      };
    }

    feedback = allErrors.map((e) => `- (${e.rule}) ${e.message}`).join('\n');
    if (attempt === maxRetries) {
      throw new Error(
        `El Editor no logró pasar el linter tras ${maxRetries + 1} intentos:\n${feedback}`,
      );
    }
  }

  throw new Error('Estado inesperado en el agente Editor.');
}
