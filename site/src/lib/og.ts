import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { REPO_ROOT } from './content.js';

interface FontCache {
  serifRegular: ArrayBuffer;
  serifBold: ArrayBuffer;
  monoRegular: ArrayBuffer;
}

let cachedFonts: FontCache | null = null;

function readFontBuffer(relPath: string): ArrayBuffer {
  const full = path.join(REPO_ROOT, 'node_modules', relPath);
  const buf = fs.readFileSync(full);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function getFonts(): FontCache {
  if (cachedFonts) return cachedFonts;
  cachedFonts = {
    serifRegular: readFontBuffer('@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff'),
    serifBold: readFontBuffer('@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff'),
    monoRegular: readFontBuffer('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff'),
  };
  return cachedFonts;
}

export interface OgCardData {
  id: string;
  fecha: string;
  estadoEtiqueta: string;
  titulo: string;
  fragmento: string;
  fuenteLabel: string;
}

/**
 * Genera tarjeta social PNG (1200x630) con Satori + Resvg en compilación (CLAUDE.md §7):
 * fecha, identificador, título, estado procesal y recorte literal del documento primario.
 */
export async function renderOgPng(card: OgCardData): Promise<Uint8Array> {
  const fonts = getFonts();
  const fragmentoCorto =
    card.fragmento.length > 260 ? `${card.fragmento.slice(0, 257)}…` : card.fragmento;

  const element = {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        backgroundColor: '#F6F3EC',
        color: '#171614',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        fontFamily: 'Source Serif 4',
        border: '12px solid #171614',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #171614',
              paddingBottom: '18px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '20px',
                    letterSpacing: '0.06em',
                  },
                  children: `LA INVARIANTE · ${card.id} · ${card.fecha}`,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '18px',
                    color: '#8C1D18',
                    border: '2px solid #8C1D18',
                    backgroundColor: '#F4E6E4',
                    padding: '6px 14px',
                    textTransform: 'uppercase',
                  },
                  children: card.estadoEtiqueta,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
              marginTop: '14px',
              marginBottom: '14px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '42px',
                    fontWeight: 600,
                    lineHeight: 1.18,
                  },
                  children: card.titulo,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#EEE9DE',
                    borderLeft: '4px solid #171614',
                    padding: '18px 22px',
                    gap: '10px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontSize: '21px',
                          lineHeight: 1.42,
                          color: '#171614',
                        },
                        children: `«${fragmentoCorto}»`,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontFamily: 'IBM Plex Mono',
                          fontSize: '16px',
                          color: '#524E46',
                        },
                        children: `Fuente primaria: ${card.fuenteLabel}`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid #CDC6B6',
              paddingTop: '14px',
              fontFamily: 'IBM Plex Mono',
              fontSize: '17px',
              color: '#524E46',
            },
            children: [
              { type: 'div', props: { children: 'Archivo hemerográfico y documental · España 1977–hoy' } },
              { type: 'div', props: { children: 'lainvariante.es' } },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(element as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Source Serif 4', data: fonts.serifRegular, weight: 400, style: 'normal' },
      { name: 'Source Serif 4', data: fonts.serifBold, weight: 600, style: 'normal' },
      { name: 'IBM Plex Mono', data: fonts.monoRegular, weight: 400, style: 'normal' },
    ],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}
