import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from './lib/env.js';
import { findContentFileById, loadPrompt, writeReport } from './lib/io.js';
import { openPullRequest } from './lib/pr.js';
import { runRecolector } from './recolectores/index.js';
import { runExtractor } from './extractor/index.js';
import { runVerificador } from './verificador/index.js';
import { runJurista } from './jurista/index.js';
import { runEditor } from './editor/index.js';
import { runCurador } from './curador/index.js';
import { runVigilante } from './vigilante/index.js';
import { runAuditor } from './auditor/index.js';
import { validateRepository } from '../scripts/validate.js';
import { lintRepository } from '../scripts/estilo/lint.js';

interface ParsedCli {
  agent: string;
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedCli {
  const [agent = 'help', ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    }
  }
  return { agent, flags };
}

function printHelp() {
  console.log(`
La Invariante — CLI de Agentes (CLAUDE.md §6 y §9)

Uso:
  npm run agent -- <agente> [opciones]

Agentes disponibles:
  recolector   Descarga documentos primarios sin LLM y calcula SHA-256 (+ R2/Wayback)
               --fuente <boe|congreso|tc|ine|url> [--anio AAAA] [--boe-id ID]
               [--fecha AAAAMMDD] [--url URL] [--serie COD] [--tabla ID] [--wayback]

  anuario      Ensambla el prompt de investigación anual listo para ejecutar año a año
               --anio AAAA [--prompt-only]

  extractor    Extrae una ficha borrador YAML desde un documento primario recolectado
               --anio AAAA [--manifest RUTA] [--doc-text RUTA] [--tipo ficha|promesa|votacion] [--prompt-only]

  verificador  Refutación adversarial con LLM DISTINTO al del Extractor
               --ficha <ID|RUTA> [--prompt-only]

  jurista      Validación jurídica (reglas deterministas + revisión LLM)
               --ficha <ID|RUTA> [--solo-reglas] [--prompt-only]

  editor       Ajuste de título y resumen (≤60 palabras, cero adjetivos) con linter integrado
               --ficha <ID|RUTA> [--prompt-only]

  curador      Búsqueda de facsímil (art. 13 TRLPI) o Wikimedia Commons con licencia verificada
               [--ficha <ID|RUTA>] [--query "..."] [--facsimil] [--aplicar]

  vigilante    Seguimiento mensual de causas con estado procesal abierto
               [--anio AAAA] [--prompt-only]

  auditor      Informe determinista de cobertura y huecos (sin LLM)
               [--anio AAAA] [--salida RUTA]

  pipeline     Ejecuta verificador -> jurista -> editor -> validate -> lint:estilo -> PR borrador
               --ficha <ID|RUTA> [--crear-pr] [--dry-run] [--prompt-only]
`);
}

async function main() {
  const { agent, flags } = parseArgs(process.argv.slice(2));
  const str = (k: string): string | undefined =>
    typeof flags[k] === 'string' ? (flags[k] as string) : undefined;
  const bool = (k: string): boolean => flags[k] === true;
  const num = (k: string): number | undefined => {
    const v = str(k);
    return v !== undefined ? Number(v) : undefined;
  };

  if (agent === 'help' || bool('help')) {
    printHelp();
    return;
  }

  switch (agent) {
    case 'recolector': {
      const fuente = str('fuente');
      if (!fuente) {
        throw new Error('Debes indicar --fuente <boe|congreso|tc|ine|url>.');
      }
      const docs = await runRecolector({
        fuente,
        anio: num('anio'),
        url: str('url'),
        boeId: str('boe-id'),
        fecha: str('fecha'),
        serie: str('serie'),
        tabla: str('tabla'),
        legislatura: str('legislatura'),
        resolucion: str('resolucion'),
        wayback: bool('wayback'),
        skipR2: bool('skip-r2'),
      });
      for (const doc of docs) {
        console.log(JSON.stringify(doc, null, 2));
      }
      break;
    }

    case 'anuario': {
      const anio = num('anio');
      if (!anio || anio < 1977 || anio > 2100) {
        throw new Error('Debes indicar --anio <AAAA> válido (1977–hoy).');
      }
      const basePrompt = loadPrompt('investigador-anuario', { ANIO: anio });
      const customYearFile = path.join(ROOT_DIR, `anuario-${anio}.md`);
      const extra = fs.existsSync(customYearFile)
        ? `\n\n---\n\n## Pistas específicas del repositorio (${path.basename(customYearFile)})\n\n${fs.readFileSync(customYearFile, 'utf8')}`
        : '';
      const assembled = basePrompt + extra;
      const out = writeReport('anuarios', `prompt-anuario-${anio}.md`, assembled);
      console.log(`Prompt de investigación del Anuario ${anio} listo en: ${path.relative(ROOT_DIR, out)}`);
      break;
    }

    case 'extractor': {
      const anio = num('anio');
      if (!anio) throw new Error('Debes indicar --anio <AAAA>.');
      const res = await runExtractor({
        anio,
        manifestPath: str('manifest'),
        docTextPath: str('doc-text'),
        tipo: (str('tipo') as 'ficha' | 'promesa' | 'votacion' | undefined) ?? 'ficha',
        idSugerido: str('id'),
        promptOnly: bool('prompt-only'),
      });
      console.log(`Extractor finalizado. Salida: ${res.outputPath ?? '(stdout)'}`);
      break;
    }

    case 'verificador': {
      const ficha = str('ficha');
      if (!ficha) throw new Error('Debes indicar --ficha <ID|RUTA>.');
      const res = await runVerificador({ ficha, promptOnly: bool('prompt-only') });
      console.log(`Verificador: ${res.veredicto} | Informe: ${path.relative(ROOT_DIR, res.reportPath)}`);
      break;
    }

    case 'jurista': {
      const ficha = str('ficha');
      if (!ficha) throw new Error('Debes indicar --ficha <ID|RUTA>.');
      const res = await runJurista({
        ficha,
        soloReglas: bool('solo-reglas'),
        promptOnly: bool('prompt-only'),
      });
      console.log(
        `Jurista: ${res.dictamen} (errores bloqueantes: ${res.blockingErrors}) | Informe: ${path.relative(ROOT_DIR, res.reportPath)}`,
      );
      if (res.dictamen === 'NO_APTO') process.exit(1);
      break;
    }

    case 'editor': {
      const ficha = str('ficha');
      if (!ficha) throw new Error('Debes indicar --ficha <ID|RUTA>.');
      const res = await runEditor({ ficha, promptOnly: bool('prompt-only') });
      console.log(
        `Editor: ${res.updated ? 'ficha actualizada y validada' : 'sin cambios'} (${path.relative(ROOT_DIR, res.filePath)})`,
      );
      break;
    }

    case 'curador': {
      const res = await runCurador({
        ficha: str('ficha'),
        query: str('query'),
        facsimil: bool('facsimil'),
        aplicar: bool('aplicar'),
      });
      console.log(JSON.stringify(res, null, 2));
      break;
    }

    case 'vigilante': {
      const res = await runVigilante({ anio: num('anio'), promptOnly: bool('prompt-only') });
      console.log(
        `Vigilante: ${res.openCount} causas abiertas | Informe: ${path.relative(ROOT_DIR, res.reportPath)}`,
      );
      break;
    }

    case 'auditor': {
      const res = runAuditor({ anio: num('anio'), salida: str('salida') });
      console.log(
        `Auditor: ${res.totalAnuarios} anuarios, ${res.totalRegistros} registros | Informe: ${path.relative(ROOT_DIR, res.reportPath)}`,
      );
      break;
    }

    case 'pipeline': {
      const fichaArg = str('ficha');
      if (!fichaArg) throw new Error('Debes indicar --ficha <ID|RUTA>.');
      const filePath = fs.existsSync(fichaArg) ? path.resolve(fichaArg) : findContentFileById(fichaArg);
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`No se encontró la ficha "${fichaArg}".`);
      }
      const baseId = path.basename(filePath, path.extname(filePath));
      const promptOnly = bool('prompt-only');

      console.log(`[1/5] Verificador (modelo distinto al Extractor) sobre ${baseId}...`);
      const ver = await runVerificador({ ficha: filePath, promptOnly });
      console.log(`      Veredicto: ${ver.veredicto}`);

      console.log(`[2/5] Jurista (reglas + revisión) sobre ${baseId}...`);
      const jur = await runJurista({
        ficha: filePath,
        soloReglas: promptOnly,
        promptOnly,
      });
      console.log(`      Dictamen: ${jur.dictamen}`);

      if (!promptOnly && (ver.veredicto === 'DESCARTAR' || jur.dictamen === 'NO_APTO')) {
        console.error('Pipeline detenido: Verificador o Jurista marcó hallazgo bloqueante.');
        process.exit(1);
      }

      if (!promptOnly) {
        console.log(`[3/5] Editor sobre ${baseId}...`);
        await runEditor({ ficha: filePath });
      }

      console.log(`[4/5] Validación de esquema, reglas cruzadas y estilo sobre ${baseId}...`);
      const val = validateRepository({ files: [filePath], enforceDirectoryMatch: true });
      const lint = lintRepository({ files: [filePath] });
      if (val.errors.length > 0 || lint.errors.length > 0) {
        for (const e of [...val.errors, ...lint.errors]) {
          console.error(`      [ERROR] (${e.rule}) ${e.message}`);
        }
        process.exit(1);
      }

      if (bool('crear-pr')) {
        console.log(`[5/5] Abriendo PR borrador para revisión humana (Regla 10)...`);
        const pr = await openPullRequest({
          branchName: `ficha/${baseId}`,
          title: `ficha: ${baseId}`,
          body: [
            `Propuesta automática de ficha \`${baseId}\` para revisión humana frente al documento primario.`,
            '',
            '- [ ] Validación contra esquema y reglas cruzadas (`npm run validate`)',
            '- [ ] Linter de estilo sin adjetivos valorativos (`npm run lint:estilo`)',
            '- [ ] Lectura humana contrastada con el documento primario original',
          ].join('\n'),
          files: [path.relative(ROOT_DIR, filePath)],
          labels: ['ficha'],
          comments: [ver.reportMarkdown, jur.reportMarkdown],
          dryRun: bool('dry-run'),
        });
        console.log(`      Rama: ${pr.branch}${pr.prUrl ? ` | PR: ${pr.prUrl}` : ''}`);
      } else {
        console.log('[5/5] Pipeline completo sin abrir PR (usa --crear-pr para proponer PR).');
      }
      break;
    }

    default:
      throw new Error(`Agente desconocido: "${agent}". Ejecuta "npm run agent -- help".`);
  }
}

main().catch((err) => {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
});
