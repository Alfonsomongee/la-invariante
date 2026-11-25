import { storeRawDocument, type StoredDocument } from '../lib/storage.js';

export interface IneCollectOptions {
  serie?: string; // Código de serie INE Tempus (p. ej. EPA / IPC)
  tabla?: string; // Código de tabla INE Tempus
  anio?: number;
  nult?: number;
  wayback?: boolean;
  skipR2?: boolean;
}

const USER_AGENT = 'LaInvariante-Recolector/1.0 (+https://lainvariante.es)';

/**
 * Recolector determinista de series estadísticas del INE (API oficial WSTempus). Sin LLM.
 */
export async function collectIne(options: IneCollectOptions): Promise<StoredDocument[]> {
  if (!options.serie && !options.tabla) {
    throw new Error('Recolector INE requiere --serie <codigoSerie> o --tabla <idTabla> de servicios.ine.es.');
  }

  const base = options.serie
    ? `https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/${encodeURIComponent(options.serie)}`
    : `https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/${encodeURIComponent(options.tabla!)}`;

  const query = options.anio
    ? `?date=${options.anio}0101:${options.anio}1231`
    : options.nult
      ? `?nult=${options.nult}`
      : '';

  const apiUrl = `${base}${query}`;
  const resp = await fetch(apiUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error(`INE WSTempus HTTP error (${resp.status}): ${apiUrl}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const doc = await storeRawDocument({
    url: apiUrl,
    buffer: buf,
    contentType: resp.headers.get('content-type') ?? 'application/json',
    sourceName: 'ine',
    anio: options.anio,
    metadata: { serie: options.serie ?? null, tabla: options.tabla ?? null },
    archiveWayback: options.wayback,
    skipR2: options.skipR2,
  });
  return [doc];
}
