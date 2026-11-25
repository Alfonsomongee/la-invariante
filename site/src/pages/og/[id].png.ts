import type { APIRoute } from 'astro';
import {
  etiquetaEstadoProcesal,
  getAllPublishedRecords,
  type AnyRecord,
} from '../../lib/content.js';
import { renderOgPng, type OgCardData } from '../../lib/og.js';

export function getStaticPaths() {
  const records = getAllPublishedRecords();
  const paths = [
    {
      params: { id: 'default' },
      props: {
        card: {
          id: 'ARCHIVO 1977–HOY',
          fecha: new Date().toISOString().slice(0, 10),
          estadoEtiqueta: 'Documento primario',
          titulo: 'La Invariante — Archivo documental del funcionamiento institucional en España',
          fragmento:
            'Registro anual con idéntico criterio para todos los partidos, series por gobierno y sección obligatoria de Contraprueba.',
          fuenteLabel: 'BOE · CENDOJ · Diario de Sesiones · Tribunal de Cuentas · INE',
        } satisfies OgCardData,
      },
    },
    ...records.map((rec: AnyRecord) => {
      const primeraFuente = rec.fuentes[0];
      const estadoEtiqueta =
        'estado_procesal' in rec
          ? etiquetaEstadoProcesal(rec.estado_procesal)
          : rec._tipo === 'promesa'
            ? 'Dijo / Firmó'
            : 'Votan juntos';

      const card: OgCardData = {
        id: rec.id,
        fecha: String(rec.anuario),
        estadoEtiqueta,
        titulo: rec.titulo,
        fragmento: primeraFuente?.fragmento ?? rec.resumen,
        fuenteLabel:
          primeraFuente?.titulo_documento ??
          `${primeraFuente?.tipo.toUpperCase() ?? 'DOC'} · ${primeraFuente?.capturado ?? ''}`,
      };
      return { params: { id: rec.id }, props: { card } };
    }),
  ];
  return paths;
}

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: OgCardData };
  const png = await renderOgPng(card);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
