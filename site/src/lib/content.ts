import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { parse as parseCsv } from 'csv-parse/sync';
import {
  CATEGORIAS,
  ESTADOS_PROCESALES,
  PESETAS_POR_EURO,
  etiquetaEstadoProcesal,
  type Anuario,
  type CategoriaCodigo,
  type Ficha,
  type Promesa,
  type Protagonista,
  type Votacion,
} from '../../../scripts/lib/constants.js';

export { CATEGORIAS, ESTADOS_PROCESALES, PESETAS_POR_EURO, etiquetaEstadoProcesal };
export type { Anuario, CategoriaCodigo, Ficha, Promesa, Protagonista, Votacion };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../../..');

export function getContentDir(): string {
  return process.env.CONTENT_DIR
    ? path.resolve(process.env.CONTENT_DIR)
    : path.join(REPO_ROOT, 'content');
}

export type AnyRecord =
  | (Ficha & { _tipo: 'ficha'; _rutaUrl: string })
  | (Promesa & { _tipo: 'promesa'; _rutaUrl: string })
  | (Votacion & { _tipo: 'votacion'; _rutaUrl: string });

export interface SeriesRow {
  anio: number;
  gobierno: string;
  partido_gobierno: string;
  valor: number;
  unidad: string;
  fuente_url: string;
  notas: string;
}

export interface GovernmentStat {
  gobierno: string;
  partido: string;
  anios: number;
  desde: number;
  hasta: number;
  media: number;
  min: number;
  max: number;
}

export interface SeriesEntry {
  id: string;
  archivo: string;
  titulo: string;
  categoria: CategoriaCodigo;
  unidad: string;
  fuente_institucional: string;
  descripcion: string;
  criterio_variacion_gobierno: string;
  rows: SeriesRow[];
  statsByGovernment: GovernmentStat[];
  variaPorGobierno: boolean;
  notaVariacion: string;
}

export interface PersonaPublica {
  slug: string;
  nombre: string;
  wikidata: string | null;
  cargos: string[];
  partidos: string[];
  registros: AnyRecord[];
}

export interface ErrataEntry {
  fecha: string;
  fuente: 'git' | 'ficha';
  referencia: string;
  cambio: string;
  motivo?: string;
}

function collectYaml(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectYaml(full));
    else if (entry.isFile() && entry.name.endsWith('.yaml')) results.push(full);
  }
  return results.sort();
}

function loadYaml<T>(filePath: string): T {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) as T;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function hasNonPublicProtagonist(record: {
  protagonistas?: Protagonista[];
  dijo?: { cargo_publico: boolean };
}): boolean {
  if (record.dijo && record.dijo.cargo_publico === false) return true;
  return (record.protagonistas ?? []).some((p) => p.cargo_publico === false);
}

function isPreviewDraftsEnabled(): boolean {
  return process.env.PREVIEW_DRAFTS === 'true';
}

export function getFichas(options: { includeRetiradas?: boolean } = {}): Ficha[] {
  const dir = path.join(getContentDir(), 'fichas');
  const all = collectYaml(dir).map((f) => loadYaml<Ficha>(f));
  const preview = isPreviewDraftsEnabled();
  return all
    .filter((f) => {
      if (preview && (f.estado_ficha === 'borrador' || f.estado_ficha === 'revision')) return true;
      return options.includeRetiradas
        ? f.estado_ficha === 'publicada' || f.estado_ficha === 'retirada'
        : f.estado_ficha === 'publicada';
    })
    .sort((a, b) => b.anuario - a.anuario || a.id.localeCompare(b.id));
}

export function getPromesas(options: { includeRetiradas?: boolean } = {}): Promesa[] {
  const dir = path.join(getContentDir(), 'promesas');
  const all = collectYaml(dir).map((f) => loadYaml<Promesa>(f));
  const preview = isPreviewDraftsEnabled();
  return all
    .filter((p) => {
      if (preview && (p.estado_ficha === 'borrador' || p.estado_ficha === 'revision')) return true;
      return options.includeRetiradas
        ? p.estado_ficha === 'publicada' || p.estado_ficha === 'retirada'
        : p.estado_ficha === 'publicada';
    })
    .sort((a, b) => b.anuario - a.anuario || a.id.localeCompare(b.id));
}

export function getVotaciones(options: { includeRetiradas?: boolean } = {}): Votacion[] {
  const dir = path.join(getContentDir(), 'votaciones');
  const all = collectYaml(dir).map((f) => loadYaml<Votacion>(f));
  const preview = isPreviewDraftsEnabled();
  return all
    .filter((v) => {
      if (preview && (v.estado_ficha === 'borrador' || v.estado_ficha === 'revision')) return true;
      return options.includeRetiradas
        ? v.estado_ficha === 'publicada' || v.estado_ficha === 'retirada'
        : v.estado_ficha === 'publicada';
    })
    .sort((a, b) => b.anuario - a.anuario || a.id.localeCompare(b.id));
}

export function getAllPublishedRecords(): AnyRecord[] {
  const fichas: AnyRecord[] = getFichas().map((f) => ({
    ...f,
    _tipo: 'ficha',
    _rutaUrl: `/fichas/${f.id}/`,
  }));
  const promesas: AnyRecord[] = getPromesas().map((p) => ({
    ...p,
    _tipo: 'promesa',
    _rutaUrl: `/promesas/${p.id}/`,
  }));
  const votaciones: AnyRecord[] = getVotaciones().map((v) => ({
    ...v,
    _tipo: 'votacion',
    _rutaUrl: `/votaciones/${v.id}/`,
  }));
  return [...fichas, ...promesas, ...votaciones].sort(
    (a, b) => b.anuario - a.anuario || a.id.localeCompare(b.id),
  );
}

export function getAnuarios(): Anuario[] {
  const dir = path.join(getContentDir(), 'anuarios');
  const preview = isPreviewDraftsEnabled();
  return collectYaml(dir)
    .map((f) => loadYaml<Anuario>(f))
    .filter((a) =>
      preview ? a.estado_anuario === 'publicado' || a.estado_anuario === 'revision' || a.estado_anuario === 'borrador' : a.estado_anuario === 'publicado',
    )
    .sort((a, b) => b.anio - a.anio);
}

export function getArchiveYears(): number[] {
  const currentYear = Math.max(2026, new Date().getFullYear());
  const years: number[] = [];
  for (let y = 1977; y <= currentYear; y++) years.push(y);
  return years;
}

export function getSeries(): SeriesEntry[] {
  const seriesDir = path.join(getContentDir(), 'series');
  const manifestPath = path.join(seriesDir, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) return [];

  const manifest = loadYaml<{ series: Array<Omit<SeriesEntry, 'rows' | 'statsByGovernment' | 'variaPorGobierno' | 'notaVariacion'>> }>(
    manifestPath,
  );

  return (manifest.series ?? []).map((meta) => {
    const csvPath = path.join(seriesDir, meta.archivo);
    let rows: SeriesRow[] = [];
    if (fs.existsSync(csvPath)) {
      const raw = fs.readFileSync(csvPath, 'utf8').trim();
      const parsed = parseCsv(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
      rows = parsed
        .map((r) => ({
          anio: Number(r.anio),
          gobierno: r.gobierno,
          partido_gobierno: r.partido_gobierno,
          valor: Number(r.valor),
          unidad: r.unidad || meta.unidad,
          fuente_url: r.fuente_url,
          notas: r.notas || '',
        }))
        .filter((r) => !Number.isNaN(r.anio) && !Number.isNaN(r.valor))
        .sort((a, b) => a.anio - b.anio);
    }

    const byGov = new Map<string, SeriesRow[]>();
    for (const row of rows) {
      const list = byGov.get(row.gobierno) ?? [];
      list.push(row);
      byGov.set(row.gobierno, list);
    }

    const statsByGovernment: GovernmentStat[] = [...byGov.entries()].map(([gobierno, list]) => {
      const vals = list.map((r) => r.valor);
      const sum = vals.reduce((a, b) => a + b, 0);
      return {
        gobierno,
        partido: list[0]?.partido_gobierno ?? '',
        anios: list.length,
        desde: Math.min(...list.map((r) => r.anio)),
        hasta: Math.max(...list.map((r) => r.anio)),
        media: Number((sum / vals.length).toFixed(2)),
        min: Math.min(...vals),
        max: Math.max(...vals),
      };
    });

    let variaPorGobierno = false;
    let notaVariacion = 'Sin datos suficientes todavía para evaluar variación entre gobiernos.';
    const distinctYears = new Set(rows.map((r) => r.anio));
    const comparableGovs = statsByGovernment.filter(
      (s) => s.partido.trim().toLowerCase() !== 'institucional',
    );
    if (distinctYears.size >= 2 && comparableGovs.length >= 2) {
      const medias = comparableGovs.map((s) => s.media);
      const maxM = Math.max(...medias);
      const minM = Math.min(...medias);
      const ratioDiff = maxM > 0 ? (maxM - minM) / maxM : 0;
      if (ratioDiff >= 0.35) {
        variaPorGobierno = true;
        const mayor = comparableGovs.find((s) => s.media === maxM)!;
        const menor = comparableGovs.find((s) => s.media === minM)!;
        notaVariacion = `La serie cambia según el gobierno: media más alta en ${mayor.gobierno} (${mayor.media} ${meta.unidad}) y más baja en ${menor.gobierno} (${menor.media} ${meta.unidad}; diferencia del ${Math.round(ratioDiff * 100)} %). Incluida en Contraprueba.`;
      } else {
        notaVariacion = `La serie muestra continuidad entre los ${comparableGovs.length} gobiernos registrados (rango de medias: ${minM}–${maxM} ${meta.unidad}).`;
      }
    } else if (statsByGovernment.length >= 1) {
      const resumenTramos = statsByGovernment
        .map((g) => `${g.gobierno}: ${g.media} ${meta.unidad}`)
        .join(' · ');
      notaVariacion = `Solo ${distinctYears.size} año documentado todavía (${resumenTramos}); se requieren al menos dos años y dos gobiernos partidistas para evaluar variación intergubernamental.`;
    }

    return {
      ...meta,
      rows,
      statsByGovernment,
      variaPorGobierno,
      notaVariacion,
    };
  });
}

/**
 * Regla §8 (STC 58/2018): solo existen páginas por persona para cargos públicos (cargo_publico: true),
 * y únicamente con hechos vinculados al ejercicio de su cargo.
 */
export function getPersonasPublicas(): PersonaPublica[] {
  const records = getAllPublishedRecords();
  const map = new Map<string, PersonaPublica>();

  for (const rec of records) {
    const lista: Protagonista[] = [...(rec.protagonistas ?? [])];
    if (rec._tipo === 'promesa' && rec.dijo) {
      lista.push({
        nombre: rec.dijo.autor,
        cargo_en_el_momento: rec.dijo.cargo_en_el_momento,
        cargo_publico: rec.dijo.cargo_publico,
        wikidata: rec.dijo.wikidata,
      });
    }

    for (const p of lista) {
      if (p.cargo_publico !== true) continue;
      const slug = slugify(p.nombre);
      const existing = map.get(slug) ?? {
        slug,
        nombre: p.nombre,
        wikidata: p.wikidata ?? null,
        cargos: [],
        partidos: [],
        registros: [],
      };
      if (!existing.wikidata && p.wikidata) existing.wikidata = p.wikidata;
      if (!existing.cargos.includes(p.cargo_en_el_momento)) {
        existing.cargos.push(p.cargo_en_el_momento);
      }
      for (const part of rec.partidos) {
        if (!existing.partidos.includes(part)) existing.partidos.push(part);
      }
      if (!existing.registros.some((r) => r.id === rec.id)) {
        existing.registros.push(rec);
      }
      map.set(slug, existing);
    }
  }

  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function getPartidos(): Array<{ sigla: string; total: number; registros: AnyRecord[] }> {
  const records = getAllPublishedRecords();
  const map = new Map<string, AnyRecord[]>();
  for (const rec of records) {
    for (const partido of rec.partidos) {
      const list = map.get(partido) ?? [];
      list.push(rec);
      map.set(partido, list);
    }
  }
  return [...map.entries()]
    .map(([sigla, registros]) => ({ sigla, total: registros.length, registros }))
    .sort((a, b) => b.total - a.total || a.sigla.localeCompare(b.sigla, 'es'));
}

export function getContrapruebas(): {
  registros: AnyRecord[];
  seriesVariables: SeriesEntry[];
} {
  const registros = getAllPublishedRecords().filter((r) => r.contraprueba === true);
  const seriesVariables = getSeries().filter((s) => s.variaPorGobierno);
  return { registros, seriesVariables };
}

export function getMetodologiaMarkdown(): string {
  const filePath = path.join(REPO_ROOT, 'docs', 'METODOLOGIA.md');
  if (!fs.existsSync(filePath)) return '# Metodología\n\nDocumento pendiente.';
  return fs.readFileSync(filePath, 'utf8');
}

export function getErratas(): ErrataEntry[] {
  const entries: ErrataEntry[] = [];

  // 1. Versiones declaradas en fichas, promesas y votaciones publicadas/retiradas
  const all = [
    ...getFichas({ includeRetiradas: true }),
    ...getPromesas({ includeRetiradas: true }),
    ...getVotaciones({ includeRetiradas: true }),
  ];
  for (const rec of all) {
    for (const v of rec.versiones) {
      entries.push({
        fecha: v.fecha,
        fuente: 'ficha',
        referencia: rec.id,
        cambio: v.cambio,
        motivo: v.motivo,
      });
    }
  }

  // 2. Historial real de Git sobre content/ (§8: CHANGELOG público generado desde Git)
  try {
    const out = execFileSync(
      'git',
      ['log', '--date=short', '--pretty=format:%ad|%h|%s', '-n', '100', '--', 'content/'],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (out) {
      for (const line of out.split(/\r?\n/)) {
        const [fecha, hash, ...rest] = line.split('|');
        if (!fecha || !hash) continue;
        entries.push({
          fecha,
          fuente: 'git',
          referencia: hash,
          cambio: rest.join('|'),
        });
      }
    }
  } catch {
    // Repositorio sin commits todavía: devolvemos solo versiones de fichas si las hay
  }

  return entries.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function formatNumberEs(value: number, maxDecimals = 2): string {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function getRectificacionConfig() {
  return {
    url: process.env.RECTIFICACION_URL || '/rectificacion/',
    email: process.env.RECTIFICACION_EMAIL || 'rectificacion@lainvariante.es',
  };
}
