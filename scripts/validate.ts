import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
import yaml from 'js-yaml';
import { parse as parseCsv } from 'csv-parse/sync';

const Ajv = (AjvModule as unknown as { default?: typeof AjvModule.default }).default ?? (AjvModule as unknown as typeof AjvModule.default);
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule.default }).default ?? (addFormatsModule as unknown as typeof addFormatsModule.default);
import {
  type Anuario,
  type Ficha,
  type Promesa,
  type ValidationIssue,
  type Votacion,
} from './lib/constants.js';
import {
  validateAnuarioCrossRules,
  validateFichaCrossRules,
  validatePromesaCrossRules,
  validateVotacionCrossRules,
} from './lib/rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT_DIR, 'schema');

type DocKind = 'ficha' | 'promesa' | 'votacion' | 'anuario';

export interface ValidateOptions {
  contentDir?: string;
  files?: string[];
  enforceDirectoryMatch?: boolean;
}

export interface ValidateResult {
  filesChecked: number;
  csvChecked: number;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function loadValidators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const fichaSchema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'ficha.schema.json'), 'utf8'));
  const promesaSchema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'promesa.schema.json'), 'utf8'));
  const votacionSchema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'votacion.schema.json'), 'utf8'));
  const anuarioSchema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'anuario.schema.json'), 'utf8'));

  ajv.addSchema(fichaSchema, 'ficha.schema.json');

  return {
    ficha: ajv.getSchema('ficha.schema.json') ?? ajv.compile(fichaSchema),
    promesa: ajv.compile(promesaSchema),
    votacion: ajv.compile(votacionSchema),
    anuario: ajv.compile(anuarioSchema),
  };
}

function collectFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, ext));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(ext)) {
      results.push(full);
    }
  }
  return results.sort();
}

function inferKind(filePath: string, data: Record<string, unknown>): DocKind | null {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/fichas/')) return 'ficha';
  if (normalized.includes('/promesas/')) return 'promesa';
  if (normalized.includes('/votaciones/')) return 'votacion';
  if (normalized.includes('/anuarios/')) return 'anuario';

  if (typeof data.anio === 'number' && Array.isArray(data.gobiernos)) return 'anuario';
  if (data.dijo && data.firmo) return 'promesa';
  if (data.sesion && data.resultado && data.grupos) return 'votacion';
  if (data.estado_procesal) return 'ficha';
  return null;
}

const REQUIRED_CSV_COLUMNS = [
  'anio',
  'gobierno',
  'partido_gobierno',
  'valor',
  'unidad',
  'fuente_url',
  'notas',
];

export function validateSeriesCsv(filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'csv-vacio',
      message: 'El archivo CSV de serie está vacío; debe incluir al menos la cabecera obligatoria.',
    });
    return issues;
  }

  const lines = raw.split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  for (const col of REQUIRED_CSV_COLUMNS) {
    if (!headers.includes(col)) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'csv-columna-obligatoria',
        message: `Falta la columna obligatoria "${col}" en la cabecera de la serie.`,
      });
    }
  }

  if (issues.length > 0) return issues;

  let records: Record<string, string>[];
  try {
    records = parseCsv(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
  } catch (err) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'csv-sintaxis',
      message: `Error de parseo CSV: ${(err as Error).message}`,
    });
    return issues;
  }

  const seenYears = new Set<string>();
  for (const [idx, row] of records.entries()) {
    const lineNum = idx + 2;
    const anio = Number(row.anio);
    if (!Number.isInteger(anio) || anio < 1977 || anio > 2100) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'csv-anio',
        message: `Fila ${lineNum}: año inválido "${row.anio}" (debe estar entre 1977 y 2100).`,
      });
    }
    const key = `${row.anio}:${row.gobierno}`;
    if (seenYears.has(key)) {
      issues.push({
        file: filePath,
        severity: 'warning',
        rule: 'csv-duplicado',
        message: `Fila ${lineNum}: entrada duplicada para año ${row.anio} y gobierno "${row.gobierno}".`,
      });
    }
    seenYears.add(key);

    if (!row.gobierno || row.gobierno.length < 2) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'csv-gobierno',
        message: `Fila ${lineNum}: la columna "gobierno" es obligatoria.`,
      });
    }
    if (!row.partido_gobierno || row.partido_gobierno.length < 2) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'csv-partido-gobierno',
        message: `Fila ${lineNum}: la columna "partido_gobierno" es obligatoria.`,
      });
    }
    if (row.valor === '' || Number.isNaN(Number(row.valor))) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'csv-valor',
        message: `Fila ${lineNum}: "valor" debe ser numérico (recibido "${row.valor}").`,
      });
    }
    if (!/^https?:\/\/.+/.test(row.fuente_url ?? '')) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'csv-fuente-url',
        message: `Fila ${lineNum}: "fuente_url" debe ser una URL válida de la fuente oficial.`,
      });
    }
  }

  return issues;
}

export function validateRepository(options: ValidateOptions = {}): ValidateResult {
  const contentDir = options.contentDir ?? path.join(ROOT_DIR, 'content');
  const enforceDirectoryMatch = options.enforceDirectoryMatch ?? true;
  const validators = loadValidators();
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, string>();

  const yamlFiles = options.files
    ? options.files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    : [
        ...collectFiles(path.join(contentDir, 'fichas'), '.yaml'),
        ...collectFiles(path.join(contentDir, 'promesas'), '.yaml'),
        ...collectFiles(path.join(contentDir, 'votaciones'), '.yaml'),
        ...collectFiles(path.join(contentDir, 'anuarios'), '.yaml'),
      ];

  const csvFiles = options.files
    ? options.files.filter((f) => f.endsWith('.csv'))
    : collectFiles(path.join(contentDir, 'series'), '.csv');

  for (const file of yamlFiles) {
    let parsed: unknown;
    try {
      const content = fs.readFileSync(file, 'utf8');
      parsed = yaml.load(content);
    } catch (err) {
      issues.push({
        file,
        severity: 'error',
        rule: 'yaml-sintaxis',
        message: `Error de sintaxis YAML: ${(err as Error).message}`,
      });
      continue;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      issues.push({
        file,
        severity: 'error',
        rule: 'yaml-objeto',
        message: 'El documento YAML debe ser un objeto en su raíz.',
      });
      continue;
    }

    const record = parsed as Record<string, unknown>;
    const kind = inferKind(file, record);
    if (!kind) {
      issues.push({
        file,
        severity: 'error',
        rule: 'tipo-desconocido',
        message: 'No se pudo determinar el tipo de documento (ficha, promesa, votacion o anuario).',
      });
      continue;
    }

    const validateSchema = validators[kind];
    const valid = validateSchema(record);
    if (!valid && validateSchema.errors) {
      for (const err of validateSchema.errors) {
        issues.push({
          file,
          severity: 'error',
          rule: `schema-${kind}`,
          message: `${err.instancePath || '/'} ${err.message ?? 'error de esquema'}${err.params ? ` (${JSON.stringify(err.params)})` : ''}`,
        });
      }
      continue;
    }

    // ID único global (nunca se reutilizan)
    if (typeof record.id === 'string') {
      const prev = seenIds.get(record.id);
      if (prev) {
        issues.push({
          file,
          severity: 'error',
          rule: 'id-duplicado',
          message: `ID duplicado "${record.id}": ya existe en ${prev}. Los ID no se reutilizan nunca.`,
        });
      } else {
        seenIds.set(record.id, file);
      }
    }

    if (kind === 'ficha') {
      issues.push(...validateFichaCrossRules(file, record as unknown as Ficha, enforceDirectoryMatch));
    } else if (kind === 'promesa') {
      issues.push(...validatePromesaCrossRules(file, record as unknown as Promesa, enforceDirectoryMatch));
    } else if (kind === 'votacion') {
      issues.push(...validateVotacionCrossRules(file, record as unknown as Votacion, enforceDirectoryMatch));
    } else if (kind === 'anuario') {
      issues.push(...validateAnuarioCrossRules(file, record as unknown as Anuario, enforceDirectoryMatch));
    }
  }

  for (const csvFile of csvFiles) {
    issues.push(...validateSeriesCsv(csvFile));
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    filesChecked: yamlFiles.length,
    csvChecked: csvFiles.length,
    issues,
    errors,
    warnings,
  };
}

function main() {
  const args = process.argv.slice(2);
  let options: ValidateOptions = {};

  if (args.length > 0) {
    const resolved = args.map((a) => path.resolve(a));
    if (resolved.length === 1 && fs.existsSync(resolved[0]) && fs.statSync(resolved[0]).isDirectory()) {
      options = { contentDir: resolved[0] };
    } else {
      options = { files: resolved, enforceDirectoryMatch: false };
    }
  }

  const result = validateRepository(options);

  for (const issue of result.issues) {
    const rel = path.relative(ROOT_DIR, issue.file);
    const tag = issue.severity === 'error' ? 'ERROR' : 'AVISO';
    console.log(`[${tag}] ${rel} (${issue.rule}): ${issue.message}`);
  }

  console.log(
    `\nValidación completada: ${result.filesChecked} archivos YAML y ${result.csvChecked} series CSV revisados | ${result.errors.length} errores, ${result.warnings.length} avisos.`,
  );

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectExecution) {
  main();
}
