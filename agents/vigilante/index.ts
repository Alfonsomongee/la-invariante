import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../lib/env.js';
import { loadPrompt, readYamlFile, writeReport } from '../lib/io.js';
import { callLlm } from '../lib/llm.js';
import { ESTADOS_PROCESALES, type Ficha } from '../../scripts/lib/constants.js';
import { todayIsoDate } from '../lib/storage.js';

export interface VigilanteArgs {
  anio?: number;
  promptOnly?: boolean;
}

function listOpenFichas(anioFiltro?: number): Array<{ filePath: string; ficha: Ficha }> {
  const fichasDir = path.join(ROOT_DIR, 'content', 'fichas');
  if (!fs.existsSync(fichasDir)) return [];

  const open: Array<{ filePath: string; ficha: Ficha }> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        const ficha = readYamlFile<Ficha>(full);
        if (anioFiltro && ficha.anuario !== anioFiltro) continue;
        if (ficha.estado_ficha === 'retirada') continue;
        const regla = ESTADOS_PROCESALES[ficha.estado_procesal?.actual];
        if (regla?.esAbierto) {
          open.push({ filePath: full, ficha });
        }
      }
    }
  };
  walk(fichasDir);
  return open.sort((a, b) => a.ficha.id.localeCompare(b.ficha.id));
}

export async function runVigilante(args: VigilanteArgs = {}): Promise<{
  openCount: number;
  reportPath: string;
}> {
  const abiertas = listOpenFichas(args.anio);
  const fecha = todayIsoDate();

  if (abiertas.length === 0) {
    const emptyReport = [
      `# Informe mensual del Vigilante — ${fecha}`,
      '',
      'No hay fichas con estado procesal abierto (`denunciado`, `investigado`, `acusado`, `condenado_no_firme`) pendientes de seguimiento.',
    ].join('\n');
    const reportPath = writeReport('vigilante', `vigilante-${fecha}.md`, emptyReport);
    return { openCount: 0, reportPath };
  }

  const listado = abiertas
    .map(({ ficha }) => {
      const ultimo = ficha.estado_procesal.historial[ficha.estado_procesal.historial.length - 1];
      return `- **${ficha.id}** (${ficha.anuario}, \`${ficha.estado_procesal.actual}\`, último hito: ${ultimo?.fecha ?? 'sin fecha'}): ${ficha.titulo}`;
    })
    .join('\n');

  const lines = [
    `# Informe mensual del Vigilante — ${fecha}`,
    '',
    `Causas abiertas detectadas: **${abiertas.length}**`,
    '',
    '## Fichas abiertas a vigilar (prioridad: archivos, absoluciones, prescripciones, sentencias firmes)',
    '',
    listado,
    '',
    '## Acciones recomendadas',
    '',
    'Para cada causa con resolución nueva en CENDOJ o BOE:',
    '1. Descargar la nueva resolución con `npm run agent -- recolector --fuente url --url <URL> --wayback`.',
    '2. Actualizar `estado_procesal.actual`, añadir el hito a `estado_procesal.historial` y registrar nueva versión en `versiones`.',
    '3. Si es `absuelto`, `archivado` o `extinguido`, actualizar la **primera oración** de `resumen` (Regla 4).',
    '4. Abrir un PR nuevo etiquetado `ficha` para revisión humana.',
  ];

  if (args.promptOnly) {
    const systemPrompt = loadPrompt('vigilante');
    const llm = await callLlm({
      role: 'vigilante',
      systemPrompt,
      userPrompt: listado,
      promptOnly: true,
    });
    lines.push('', '---', '', llm.text);
  }

  const reportPath = writeReport('vigilante', `vigilante-${fecha}.md`, lines.join('\n'));
  return { openCount: abiertas.length, reportPath };
}
