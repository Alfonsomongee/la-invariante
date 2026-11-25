import { storeRawDocument, type StoredDocument } from '../lib/storage.js';

export interface UrlCollectOptions {
  url: string;
  anio?: number;
  wayback?: boolean;
  skipR2?: boolean;
}

const USER_AGENT = 'LaInvariante-Recolector/1.0 (+https://lainvariante.es)';

/**
 * Recolector determinista genérico para cualquier URL de fuente primaria
 * (CENDOJ, Tribunal de Cuentas, BORME, Banco de España, Manifesto Project, etc.).
 * Sin LLM, nunca resume: descarga bytes exactos, calcula SHA-256 y guarda manifiesto.
 */
export async function collectUrl(options: UrlCollectOptions): Promise<StoredDocument[]> {
  if (!options.url) {
    throw new Error('Recolector URL requiere --url <https://...>.');
  }
  const parsed = new URL(options.url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Protocolo no permitido: ${parsed.protocol}`);
  }

  const resp = await fetch(options.url, { headers: { 'user-agent': USER_AGENT } });
  if (!resp.ok) {
    throw new Error(`HTTP error (${resp.status}) descargando ${options.url}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const doc = await storeRawDocument({
    url: options.url,
    buffer: buf,
    contentType: resp.headers.get('content-type') ?? 'application/octet-stream',
    sourceName: 'url',
    anio: options.anio,
    archiveWayback: options.wayback,
    skipR2: options.skipR2,
  });
  return [doc];
}
