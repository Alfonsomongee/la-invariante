import type { StoredDocument } from '../lib/storage.js';
import { collectBoe } from './boe.js';
import { collectCongreso } from './congreso.js';
import { collectIne } from './ine.js';
import { collectTc } from './tc.js';
import { collectUrl } from './url.js';

export interface RecolectorArgs {
  fuente: string;
  anio?: number;
  url?: string;
  boeId?: string;
  fecha?: string;
  serie?: string;
  tabla?: string;
  legislatura?: string;
  resolucion?: string;
  wayback?: boolean;
  skipR2?: boolean;
}

export async function runRecolector(args: RecolectorArgs): Promise<StoredDocument[]> {
  switch (args.fuente) {
    case 'boe':
      return collectBoe({
        anio: args.anio,
        boeId: args.boeId,
        fecha: args.fecha,
        wayback: args.wayback,
        skipR2: args.skipR2,
      });
    case 'congreso':
      return collectCongreso({
        url: args.url,
        anio: args.anio,
        legislatura: args.legislatura,
        wayback: args.wayback,
        skipR2: args.skipR2,
      });
    case 'tc':
      return collectTc({
        url: args.url,
        anio: args.anio,
        resolucion: args.resolucion,
        wayback: args.wayback,
        skipR2: args.skipR2,
      });
    case 'ine':
      return collectIne({
        serie: args.serie,
        tabla: args.tabla,
        anio: args.anio,
        wayback: args.wayback,
        skipR2: args.skipR2,
      });
    case 'url':
      if (!args.url) throw new Error('Recolector "url" requiere --url <https://...>');
      return collectUrl({
        url: args.url,
        anio: args.anio,
        wayback: args.wayback,
        skipR2: args.skipR2,
      });
    default:
      throw new Error(
        `Fuente de recolector desconocida: "${args.fuente}". Fuentes soportadas: boe, congreso, tc, ine, url.`,
      );
  }
}
