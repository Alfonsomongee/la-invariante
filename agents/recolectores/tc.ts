import { storeRawDocument, type StoredDocument } from '../lib/storage.js';

export interface TcCollectOptions {
  url?: string;
  resolucion?: string; // Ej: STC 108/1986 -> se pasa URL oficial hj.tribunalconstitucional.es
  anio?: number;
  wayback?: boolean;
  skipR2?: boolean;
}

const USER_AGENT = 'LaInvariante-Recolector/1.0 (+https://lainvariante.es)';

/**
 * Recolector determinista del Tribunal Constitucional (hj.tribunalconstitucional.es). Sin LLM.
 */
export async function collectTc(options: TcCollectOptions): Promise<StoredDocument[]> {
  if (!options.url) {
    throw new Error(
      'Recolector TC requiere --url <URL de hj.tribunalconstitucional.es o boe.es para la STC/ATC>.',
    );
  }

  const parsed = new URL(options.url);
  if (!parsed.hostname.endsWith('tribunalconstitucional.es') && !parsed.hostname.endsWith('boe.es')) {
    throw new Error(
      `URL rechazada por recolector TC: debe pertenecer a tribunalconstitucional.es o boe.es (recibido: ${parsed.hostname}).`,
    );
  }

  const resp = await fetch(options.url, { headers: { 'user-agent': USER_AGENT } });
  if (!resp.ok) {
    throw new Error(`Tribunal Constitucional HTTP error (${resp.status}): ${options.url}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const doc = await storeRawDocument({
    url: options.url,
    buffer: buf,
    contentType: resp.headers.get('content-type') ?? 'text/html',
    sourceName: 'tc',
    anio: options.anio,
    metadata: { resolucion: options.resolucion ?? null },
    archiveWayback: options.wayback,
    skipR2: options.skipR2,
  });
  return [doc];
}
