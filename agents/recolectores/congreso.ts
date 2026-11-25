import { storeRawDocument, type StoredDocument } from '../lib/storage.js';

export interface CongresoCollectOptions {
  url?: string;
  anio?: number;
  legislatura?: string;
  wayback?: boolean;
  skipR2?: boolean;
}

const USER_AGENT = 'LaInvariante-Recolector/1.0 (+https://lainvariante.es)';

/**
 * Recolector determinista de documentos oficiales del Congreso de los Diputados
 * (Diario de Sesiones, votaciones abiertas y publicaciones oficiales). Sin LLM.
 */
export async function collectCongreso(options: CongresoCollectOptions): Promise<StoredDocument[]> {
  if (!options.url) {
    throw new Error(
      'Recolector Congreso requiere --url <URL oficial de congreso.es> (p. ej. PDF/HTML de Diario de Sesiones o JSON de votaciones).',
    );
  }

  const parsed = new URL(options.url);
  if (!parsed.hostname.endsWith('congreso.es')) {
    throw new Error(`URL rechazada por recolector congreso: el dominio debe ser *.congreso.es (recibido: ${parsed.hostname}).`);
  }

  const resp = await fetch(options.url, { headers: { 'user-agent': USER_AGENT } });
  if (!resp.ok) {
    throw new Error(`Congreso HTTP error (${resp.status}): ${options.url}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const doc = await storeRawDocument({
    url: options.url,
    buffer: buf,
    contentType: resp.headers.get('content-type') ?? 'application/octet-stream',
    sourceName: 'congreso',
    anio: options.anio,
    metadata: { legislatura: options.legislatura ?? null },
    archiveWayback: options.wayback,
    skipR2: options.skipR2,
  });
  return [doc];
}
