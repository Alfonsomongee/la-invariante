import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  contarPalabras,
  normalizarTexto,
  type EstadoProcesalValor,
  type ValidationIssue,
} from '../lib/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_BLACKLIST_PATH = path.join(__dirname, 'adjetivos.txt');

const MAX_PALABRAS_RESUMEN = 60;
const MAX_PALABRAS_TITULO = 22;
const MAX_PALABRAS_CONTEXTO_ANUARIO = 150;

export interface BlacklistEntry {
  raw: string;
  regex: RegExp;
}

export function loadBlacklist(blacklistPath = DEFAULT_BLACKLIST_PATH): BlacklistEntry[] {
  const raw = fs.readFileSync(blacklistPath, 'utf8');
  const entries: BlacklistEntry[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const norm = normalizarTexto(trimmed);
    const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = norm.endsWith('*')
      ? `\\b${escaped.slice(0, -2)}[a-zñ]*\\b`
      : `\\b${escaped}\\b`;
    entries.push({ raw: trimmed, regex: new RegExp(pattern, 'gi') });
  }
  return entries;
}

export function findBlacklistedTerms(texto: string, blacklist: BlacklistEntry[]): string[] {
  const norm = normalizarTexto(texto);
  const matches = new Set<string>();
  for (const entry of blacklist) {
    entry.regex.lastIndex = 0;
    const found = norm.match(entry.regex);
    if (found) {
      for (const m of found) {
        matches.add(m);
      }
    }
  }
  return [...matches];
}

// Reglas de léxico procesal: prohíben afirmar culpabilidad o escalar la fase procesal
const TERMINOS_CONDENA_CULPABILIDAD = [
  /\bcondenad[oa]s?\b/i,
  /\bcondeno\b/i,
  /\bculpabl(?:e|es)\b/i,
  /\bdelincuent(?:e|es)\b/i,
  /\bcorrupt[oa]s?\b/i,
  /\bmalverso\b/i,
  /\bsoborno\b/i,
  /\bprevarico\b/i,
  /\brobo\b/i,
];

const ESTADOS_SIN_CONDENA: ReadonlySet<EstadoProcesalValor> = new Set([
  'denunciado',
  'investigado',
  'acusado',
  'absuelto',
  'archivado',
  'extinguido',
  'no_judicial',
]);

export function checkProceduralLexicon(
  filePath: string,
  texto: string,
  campo: string,
  estadoActual: EstadoProcesalValor,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const norm = normalizarTexto(texto);

  if (ESTADOS_SIN_CONDENA.has(estadoActual)) {
    for (const pattern of TERMINOS_CONDENA_CULPABILIDAD) {
      const m = norm.match(pattern);
      if (m) {
        // Permitir explícitamente frases como "no condenó" o "absolvió de la condena" en absuelto/archivado
        const idx = m.index ?? 0;
        const previo = norm.slice(Math.max(0, idx - 18), idx);
        if (/\b(no|sin|revoco|anulo|absolvio)\s+$/.test(previo)) continue;
        issues.push({
          file: filePath,
          severity: 'error',
          rule: 'estilo-lexico-procesal',
          message: `${campo}: el término "${m[0]}" escala la gravedad respecto al estado procesal "${estadoActual}" (presunción de inocencia / escala cerrada).`,
        });
      }
    }
  }

  if (estadoActual === 'condenado_no_firme' && /\b(firme|condena firme|sentencia firme)\b/i.test(norm)) {
    const idx = norm.search(/\b(firme|condena firme|sentencia firme)\b/i);
    const previo = norm.slice(Math.max(0, idx - 6), idx);
    if (!/\bno\s+$/.test(previo)) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'estilo-lexico-firmeza',
        message: `${campo}: el estado es "condenado_no_firme"; no puede referirse a sentencia o condena firme.`,
      });
    }
  }

  if (
    (estadoActual === 'denunciado' || estadoActual === 'investigado') &&
    /\b(acusad[oa]s?|procesad[oa]s?|juicio oral)\b/i.test(norm)
  ) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'estilo-lexico-fase',
      message: `${campo}: el estado es "${estadoActual}"; no usar "acusado", "procesado" ni "juicio oral" antes del auto correspondiente.`,
    });
  }

  return issues;
}

export function lintDocument(
  filePath: string,
  data: Record<string, unknown>,
  blacklist: BlacklistEntry[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const checkField = (campo: string, valor: unknown, maxWords?: number, forbidPunctuation = false) => {
    if (typeof valor !== 'string' || !valor.trim()) return;

    const prohibidos = findBlacklistedTerms(valor, blacklist);
    if (prohibidos.length > 0) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'estilo-adjetivos',
        message: `${campo} contiene términos valorativos prohibidos (Regla 6): ${prohibidos.join(', ')}.`,
      });
    }

    if (maxWords !== undefined) {
      const palabras = contarPalabras(valor);
      if (palabras > maxWords) {
        issues.push({
          file: filePath,
          severity: 'error',
          rule: 'estilo-longitud',
          message: `${campo} tiene ${palabras} palabras (máximo permitido: ${maxWords}).`,
        });
      }
    }

    if (forbidPunctuation && /[!?¡¿]/.test(valor)) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'estilo-puntuacion',
        message: `${campo} no debe contener signos de exclamación ni interrogación retórica.`,
      });
    }
  };

  checkField('titulo', data.titulo, MAX_PALABRAS_TITULO, true);
  checkField('resumen', data.resumen, MAX_PALABRAS_RESUMEN, true);
  checkField('contexto_resumen', data.contexto_resumen, MAX_PALABRAS_CONTEXTO_ANUARIO, true);

  if (data.firmo && typeof data.firmo === 'object') {
    const firmo = data.firmo as Record<string, unknown>;
    checkField('firmo.descripcion_factual', firmo.descripcion_factual, undefined, true);
  }

  if (data.estado_procesal && typeof data.estado_procesal === 'object') {
    const ep = data.estado_procesal as { actual?: EstadoProcesalValor };
    if (ep.actual) {
      if (typeof data.titulo === 'string') {
        issues.push(...checkProceduralLexicon(filePath, data.titulo, 'titulo', ep.actual));
      }
      if (typeof data.resumen === 'string') {
        issues.push(...checkProceduralLexicon(filePath, data.resumen, 'resumen', ep.actual));
      }
    }
  }

  return issues;
}

function collectYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectYamlFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
      results.push(full);
    }
  }
  return results.sort();
}

export function lintRepository(options: { contentDir?: string; files?: string[] } = {}) {
  const blacklist = loadBlacklist();
  const contentDir = options.contentDir ?? path.join(ROOT_DIR, 'content');
  const files = options.files ?? [
    ...collectYamlFiles(path.join(contentDir, 'fichas')),
    ...collectYamlFiles(path.join(contentDir, 'promesas')),
    ...collectYamlFiles(path.join(contentDir, 'votaciones')),
    ...collectYamlFiles(path.join(contentDir, 'anuarios')),
  ];

  const issues: ValidationIssue[] = [];
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = yaml.load(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      issues.push({
        file,
        severity: 'error',
        rule: 'estilo-yaml',
        message: `No se pudo leer YAML: ${(err as Error).message}`,
      });
      continue;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      issues.push(...lintDocument(file, parsed as Record<string, unknown>, blacklist));
    }
  }

  return {
    filesChecked: files.length,
    issues,
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
  };
}

function main() {
  const args = process.argv.slice(2);
  let options: { contentDir?: string; files?: string[] } = {};

  if (args.length > 0) {
    const resolved = args.map((a) => path.resolve(a));
    if (resolved.length === 1 && fs.existsSync(resolved[0]) && fs.statSync(resolved[0]).isDirectory()) {
      options = { contentDir: resolved[0] };
    } else {
      options = { files: resolved };
    }
  }

  const result = lintRepository(options);
  for (const issue of result.issues) {
    const rel = path.relative(ROOT_DIR, issue.file);
    const tag = issue.severity === 'error' ? 'ERROR' : 'AVISO';
    console.log(`[${tag}] ${rel} (${issue.rule}): ${issue.message}`);
  }

  console.log(
    `\nLinter de estilo completado: ${result.filesChecked} archivos revisados | ${result.errors.length} errores, ${result.warnings.length} avisos.`,
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
