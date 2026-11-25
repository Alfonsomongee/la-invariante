import fs from 'node:fs';
import path from 'node:path';
import { findContentFileById, readYamlFile, writeYamlFile } from '../lib/io.js';
import type { Fuente, Imagen, LicenciaImagen } from '../../scripts/lib/constants.js';

export interface CuradorArgs {
  ficha?: string;
  query?: string;
  facsimil?: boolean;
  aplicar?: boolean;
}

/**
 * Mapea estrictamente licencias legibles por máquina de Wikimedia Commons.
 * Regla §6 y §8: rechaza NC, ND, Fair Use, prensa, agencias o licencia desconocida.
 */
export function mapCommonsLicense(
  licenseShortName?: string,
  licenseUrl?: string,
): LicenciaImagen | null {
  const short = (licenseShortName ?? '').trim().toLowerCase();
  const url = (licenseUrl ?? '').trim().toLowerCase();
  const combined = `${short} ${url}`;

  if (!combined.trim()) return null;
  // Rechazo explícito de cláusulas prohibidas
  if (/\b(nc|nd|non-?commercial|no-?derivs|fair\s*use|copyrighted|all rights reserved)\b/i.test(combined)) {
    return null;
  }

  if (/\b(pd|public domain|dominio publico)\b/i.test(combined) || url.includes('/publicdomain/mark')) {
    return 'pd';
  }
  if (/\bcc0\b/i.test(combined) || url.includes('/publicdomain/zero')) {
    return 'cc0';
  }
  if (/\bcc[- ]?by[- ]?sa\b/i.test(combined) || url.includes('/licenses/by-sa/')) {
    return 'cc-by-sa';
  }
  if (/\bcc[- ]?by\b/i.test(combined) || url.includes('/licenses/by/')) {
    return 'cc-by';
  }
  return null;
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export async function searchWikimediaCommons(query: string): Promise<Imagen[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: query,
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    format: 'json',
    origin: '*',
  });

  const apiUrl = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  const resp = await fetch(apiUrl, {
    headers: { 'user-agent': 'LaInvariante-Curador/1.0 (+https://lainvariante.es)' },
  });
  if (!resp.ok) {
    throw new Error(`Wikimedia Commons API error (${resp.status})`);
  }

  const json = (await resp.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: Array<{
            url?: string;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };

  const candidates: Imagen[] = [];
  const pages = Object.values(json.query?.pages ?? {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.extmetadata || !info.descriptionurl) continue;

    const licencia = mapCommonsLicense(
      info.extmetadata.LicenseShortName?.value,
      info.extmetadata.LicenseUrl?.value,
    );
    if (!licencia) continue;

    const rawArtist = info.extmetadata.Artist?.value ?? info.extmetadata.Credit?.value ?? '';
    const autor = stripHtml(rawArtist);
    if (!autor || autor.length < 2) continue;

    candidates.push({
      tipo: 'foto',
      licencia,
      autor: autor.slice(0, 150),
      origen: info.descriptionurl,
      archivo: info.url,
      alt: page.title.replace(/^File:/i, '').replace(/\.[^.]+$/, ''),
    });
  }

  // Prioridad §8: pd > cc0 > cc-by > cc-by-sa
  const priority: Record<LicenciaImagen, number> = {
    art13_trlpi: 0,
    pool_moncloa: 1,
    pd: 2,
    cc0: 3,
    'cc-by': 4,
    'cc-by-sa': 5,
  };
  candidates.sort((a, b) => priority[a.licencia] - priority[b.licencia]);
  return candidates;
}

export async function runCurador(args: CuradorArgs): Promise<{
  imagen: Imagen | null;
  candidatos: Imagen[];
  aplicada: boolean;
}> {
  let filePath: string | null = null;
  let data: Record<string, unknown> | null = null;

  if (args.ficha) {
    filePath = fs.existsSync(args.ficha)
      ? path.resolve(args.ficha)
      : findContentFileById(args.ficha);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`No se encontró la ficha "${args.ficha}".`);
    }
    data = readYamlFile<Record<string, unknown>>(filePath);
  }

  // Prioridad 1 (§8): facsímil oficial acogido al art. 13 TRLPI desde BOE / Diario de Sesiones / sentencia
  if (args.facsimil && data) {
    const fuentes = (data.fuentes as Fuente[]) ?? [];
    const oficial = fuentes.find((f) =>
      f.tipo === 'boe' || f.tipo === 'diario_sesiones' || f.tipo === 'sentencia' || f.tipo === 'auto' || f.tipo === 'tcu',
    );
    if (oficial) {
      const autorPorTipo: Record<string, string> = {
        boe: 'Agencia Estatal Boletín Oficial del Estado',
        diario_sesiones: 'Cortes Generales — Diario de Sesiones',
        sentencia: 'Poder Judicial — Resolución oficial',
        auto: 'Poder Judicial — Resolución oficial',
        tcu: 'Tribunal de Cuentas',
      };
      const imagen: Imagen = {
        tipo: 'facsimil',
        licencia: 'art13_trlpi',
        autor: autorPorTipo[oficial.tipo] ?? 'Organismo oficial',
        origen: oficial.url,
        alt: oficial.titulo_documento ?? `Facsímil de documento oficial (${oficial.tipo})`,
      };
      if (args.aplicar && filePath) {
        data.imagen = imagen;
        writeYamlFile(filePath, data);
      }
      return { imagen, candidatos: [imagen], aplicada: Boolean(args.aplicar && filePath) };
    }
  }

  const query = args.query ?? (typeof data?.titulo === 'string' ? data.titulo : '');
  if (!query) {
    return { imagen: null, candidatos: [], aplicada: false };
  }

  const candidatos = await searchWikimediaCommons(query);
  const mejor = candidatos[0] ?? null;

  if (args.aplicar && filePath && data) {
    data.imagen = mejor;
    writeYamlFile(filePath, data);
  }

  return {
    imagen: mejor,
    candidatos,
    aplicada: Boolean(args.aplicar && filePath),
  };
}
