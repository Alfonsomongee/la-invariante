import { storeRawDocument, type StoredDocument } from '../lib/storage.js';

export interface BoeCollectOptions {
  anio?: number;
  boeId?: string;
  fecha?: string; // YYYYMMDD o YYYY-MM-DD
  rango?: 'ley_organica' | 'decreto_ley' | 'indulto' | 'todos';
  wayback?: boolean;
  skipR2?: boolean;
}

const USER_AGENT = 'LaInvariante-Recolector/1.0 (+https://lainvariante.es)';

/**
 * Recolector determinista del Boletín Oficial del Estado (sin LLM, nunca resume).
 * Soporta:
 *  - Descarga directa de una disposición por ID (p. ej. BOE-A-1985-11672)
 *  - Sumario diario oficial (API de Datos Abiertos del BOE)
 *  - Consulta de legislación consolidada por año (API de Datos Abiertos del BOE)
 */
export async function collectBoe(options: BoeCollectOptions): Promise<StoredDocument[]> {
  const results: StoredDocument[] = [];

  if (options.boeId) {
    const cleanId = options.boeId.trim();
    const xmlUrl = `https://www.boe.es/diario_boe/xml.php?id=${encodeURIComponent(cleanId)}`;
    const resp = await fetch(xmlUrl, { headers: { 'user-agent': USER_AGENT, accept: 'application/xml' } });
    if (!resp.ok) {
      throw new Error(`BOE XML error (${resp.status}) para ${cleanId}: ${xmlUrl}`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const doc = await storeRawDocument({
      url: xmlUrl,
      buffer: buf,
      contentType: resp.headers.get('content-type') ?? 'application/xml',
      sourceName: 'boe',
      anio: options.anio,
      metadata: { boeId: cleanId, modo: 'disposicion_xml' },
      archiveWayback: options.wayback,
      skipR2: options.skipR2,
    });
    results.push(doc);
    return results;
  }

  if (options.fecha) {
    const yyyymmdd = options.fecha.replace(/-/g, '');
    const apiUrl = `https://www.boe.es/datosabiertos/api/boe/sumario/${yyyymmdd}`;
    const resp = await fetch(apiUrl, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (!resp.ok) {
      throw new Error(`BOE Sumario API error (${resp.status}) para ${yyyymmdd}: ${apiUrl}`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const doc = await storeRawDocument({
      url: apiUrl,
      buffer: buf,
      contentType: resp.headers.get('content-type') ?? 'application/json',
      sourceName: 'boe',
      anio: options.anio ?? Number(yyyymmdd.slice(0, 4)),
      metadata: { fecha: yyyymmdd, modo: 'sumario_diario' },
      archiveWayback: options.wayback,
      skipR2: options.skipR2,
    });
    results.push(doc);
    return results;
  }

  if (options.anio) {
    // API oficial de legislación consolidada filtrada por año de publicación
    const queryObj = {
      query: {
        range: {
          fecha_publicacion: {
            gte: `${options.anio}0101`,
            lte: `${options.anio}1231`,
          },
        },
      },
    };
    const params = new URLSearchParams({
      from: `${options.anio}0101`,
      to: `${options.anio}1231`,
      limit: '500',
      query: JSON.stringify(queryObj),
    });
    const apiUrl = `https://www.boe.es/datosabiertos/api/legislacion-consolidada?${params.toString()}`;
    const resp = await fetch(apiUrl, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (!resp.ok) {
      throw new Error(`BOE Legislación API error (${resp.status}) para ${options.anio}`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const doc = await storeRawDocument({
      url: apiUrl,
      buffer: buf,
      contentType: resp.headers.get('content-type') ?? 'application/json',
      sourceName: 'boe',
      anio: options.anio,
      metadata: { anio: options.anio, rango: options.rango ?? 'todos', modo: 'legislacion_anual' },
      archiveWayback: options.wayback,
      skipR2: options.skipR2,
    });
    results.push(doc);
    return results;
  }

  throw new Error('Recolector BOE requiere --boe-id <BOE-A-...>, --fecha <AAAAMMDD> o --anio <AAAA>.');
}
