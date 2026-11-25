import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../lib/env.js';
import { readYamlFile, writeReport } from '../lib/io.js';
import { todayIsoDate } from '../lib/storage.js';
import {
  CATEGORIAS,
  ESTADOS_PROCESALES,
  type Anuario,
  type CategoriaCodigo,
  type Ficha,
  type Promesa,
  type Votacion,
} from '../../scripts/lib/constants.js';

export interface AuditorArgs {
  anio?: number;
  salida?: string;
}

type RegistroArchivo = Ficha | Promesa | Votacion;

function collectYaml(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectYaml(full));
    else if (entry.isFile() && entry.name.endsWith('.yaml')) out.push(full);
  }
  return out.sort();
}

/**
 * Agente Auditor (script puro, sin LLM).
 * Regla dura §6: «Los huecos generan búsquedas, no fichas.»
 */
export function runAuditor(args: AuditorArgs = {}): {
  reportPath: string;
  totalRegistros: number;
  totalAnuarios: number;
  reportMarkdown: string;
} {
  const contentDir = path.join(ROOT_DIR, 'content');
  const recordFiles = [
    ...collectYaml(path.join(contentDir, 'fichas')),
    ...collectYaml(path.join(contentDir, 'promesas')),
    ...collectYaml(path.join(contentDir, 'votaciones')),
  ];
  const anuarioFiles = collectYaml(path.join(contentDir, 'anuarios'));

  const records: RegistroArchivo[] = recordFiles
    .map((f) => readYamlFile<RegistroArchivo>(f))
    .filter((r) => !args.anio || r.anuario === args.anio);

  const anuarios: Anuario[] = anuarioFiles
    .map((f) => readYamlFile<Anuario>(f))
    .filter((a) => !args.anio || a.anio === args.anio);

  const porCategoria = new Map<string, number>();
  for (const code of Object.keys(CATEGORIAS)) porCategoria.set(code, 0);

  const porPartido = new Map<string, number>();
  const porNivel = new Map<string, number>([
    ['estatal', 0],
    ['autonomico', 0],
    ['local', 0],
  ]);
  const porEstadoFicha = new Map<string, number>();
  const porAnio = new Map<number, number>();
  let contrapruebas = 0;
  let conShaPendiente = 0;
  let causasAbiertas = 0;

  for (const rec of records) {
    porCategoria.set(rec.categoria, (porCategoria.get(rec.categoria) ?? 0) + 1);
    porNivel.set(rec.nivel, (porNivel.get(rec.nivel) ?? 0) + 1);
    porEstadoFicha.set(rec.estado_ficha, (porEstadoFicha.get(rec.estado_ficha) ?? 0) + 1);
    porAnio.set(rec.anuario, (porAnio.get(rec.anuario) ?? 0) + 1);

    for (const p of rec.partidos) {
      porPartido.set(p, (porPartido.get(p) ?? 0) + 1);
    }
    if (rec.contraprueba) contrapruebas++;
    if (rec.fuentes.some((f) => f.sha256 === 'pendiente')) conShaPendiente++;
    if ('estado_procesal' in rec && ESTADOS_PROCESALES[rec.estado_procesal.actual]?.esAbierto) {
      causasAbiertas++;
    }
  }

  const anioActual = new Date().getFullYear();
  const anosConAnuario = new Set(anuarios.map((a) => a.anio));
  const rangoInicio = args.anio ?? 1977;
  const rangoFin = args.anio ?? anioActual;
  const anosPendientes: number[] = [];
  for (let y = rangoInicio; y <= rangoFin; y++) {
    if (!anosConAnuario.has(y)) anosPendientes.push(y);
  }

  const categoriasVacias = (Object.keys(CATEGORIAS) as CategoriaCodigo[]).filter(
    (c) => (porCategoria.get(c) ?? 0) === 0,
  );

  const fecha = todayIsoDate();
  const lines: string[] = [
    `# Informe de cobertura — Agente Auditor (${fecha})`,
    '',
    `> Ámbito: ${args.anio ? `Anuario ${args.anio}` : `Archivo completo (1977–${anioActual})`}. Regla dura: **los huecos generan búsquedas, nunca fichas forzadas.**`,
    '',
    '## Resumen general',
    '',
    `- **Anuarios documentados:** ${anuarios.length}`,
    `- **Registros totales (fichas + promesas + votaciones):** ${records.length}`,
    `- **Registros en Contraprueba:** ${contrapruebas}`,
    `- **Causas procesalmente abiertas (seguimiento Vigilante):** ${causasAbiertas}`,
    `- **Registros con algún \`sha256: pendiente\`:** ${conShaPendiente}`,
    '',
    '## Cobertura por categoría',
    '',
    '| Código | Categoría | Registros |',
    '| --- | --- | ---: |',
    ...(Object.keys(CATEGORIAS) as CategoriaCodigo[]).map(
      (c) => `| \`${c}\` | ${CATEGORIAS[c].nombre} | ${porCategoria.get(c) ?? 0} |`,
    ),
    '',
    '## Cobertura por partido',
    '',
    ...(porPartido.size === 0
      ? ['Sin registros todavía.']
      : [
          '| Partido | Registros |',
          '| --- | ---: |',
          ...[...porPartido.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([p, n]) => `| ${p} | ${n} |`),
        ]),
    '',
    '## Cobertura por nivel territorial',
    '',
    '| Nivel | Registros |',
    '| --- | ---: |',
    ...[...porNivel.entries()].map(([n, c]) => `| ${n} | ${c} |`),
    '',
    '## Huecos detectados y búsquedas sugeridas',
    '',
    `- **Categorías sin registros en este ámbito (${categoriasVacias.length}):** ${
      categoriasVacias.length > 0 ? categoriasVacias.join(', ') : 'Ninguna'
    }`,
    `- **Años sin archivo de anuario (${anosPendientes.length}):** ${
      anosPendientes.length > 12
        ? `${anosPendientes.slice(0, 6).join(', ')} … ${anosPendientes.slice(-4).join(', ')}`
        : anosPendientes.join(', ') || 'Ninguno'
    }`,
    '',
    '### Próximas búsquedas recomendadas',
    '',
    ...(anosPendientes.slice(0, 5).map(
      (y) =>
        `- Iniciar anuario **${y}**: \`npm run agent -- recolector --fuente boe --anio ${y}\` y \`npm run agent -- anuario --anio ${y} --prompt-only\``,
    )),
  ];

  const reportMarkdown = lines.join('\n');
  let reportPath: string;
  if (args.salida) {
    const abs = path.resolve(args.salida);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, reportMarkdown, 'utf8');
    reportPath = abs;
  } else {
    const suffix = args.anio ? `auditor-${args.anio}-${fecha}.md` : `auditor-${fecha}.md`;
    reportPath = writeReport('auditor', suffix, reportMarkdown);
  }

  return {
    reportPath,
    totalRegistros: records.length,
    totalAnuarios: anuarios.length,
    reportMarkdown,
  };
}
