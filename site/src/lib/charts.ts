import type { SeriesEntry, Votacion } from './content.js';

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Genera una gráfica SVG estática en compilación (ADR 0004):
 * - Cero librerías cliente.
 * - Cero colores de partido: periodos de gobierno marcados con bandas neutras alternas y tipografía mono.
 */
export function renderSeriesSvg(series: SeriesEntry): string {
  const width = 760;
  const height = 310;
  const padLeft = 58;
  const padRight = 22;
  const padTop = 34;
  const padBottom = 56;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  if (series.rows.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(series.titulo)} — sin datos publicados todavía" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#F6F3EC" />
  <rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" fill="none" stroke="#CDC6B6" stroke-dasharray="4 4" />
  <text x="${width / 2}" y="${height / 2 - 4}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" fill="#524E46">Serie preparada (0 observaciones publicadas todavía)</text>
  <text x="${width / 2}" y="${height / 2 + 18}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#524E46">Archivo fuente: content/series/${escapeXml(series.archivo)}</text>
</svg>`;
  }

  const rows = [...series.rows].sort((a, b) => a.anio - b.anio);
  const minYear = rows[0].anio;
  const maxYear = rows[rows.length - 1].anio;
  const yearSpan = Math.max(1, maxYear - minYear);
  const maxVal = Math.max(...rows.map((r) => r.valor), 1);
  const niceMax = Math.ceil(maxVal * 1.12 * 10) / 10;

  const xOf = (anio: number) =>
    rows.length === 1
      ? padLeft + plotW / 2
      : padLeft + ((anio - minYear) / yearSpan) * plotW;
  const yOf = (val: number) => padTop + plotH - (val / niceMax) * plotH;

  // Segmentos contiguos por gobierno (bandas neutras alternas, SIN colores de partido)
  interface Band {
    gobierno: string;
    startYear: number;
    endYear: number;
    idx: number;
  }
  const bands: Band[] = [];
  for (const r of rows) {
    const prev = bands[bands.length - 1];
    if (prev && prev.gobierno === r.gobierno) {
      prev.endYear = r.anio;
    } else {
      bands.push({
        gobierno: r.gobierno,
        startYear: r.anio,
        endYear: r.anio,
        idx: bands.length,
      });
    }
  }

  const halfStep = rows.length > 1 ? plotW / (yearSpan * 2) : plotW / 2;

  const bandRects = bands
    .map((b) => {
      const x1 = Math.max(padLeft, xOf(b.startYear) - halfStep);
      const x2 = Math.min(padLeft + plotW, xOf(b.endYear) + halfStep);
      const w = Math.max(4, x2 - x1);
      const fill = b.idx % 2 === 0 ? '#EEE9DE' : '#F6F3EC';
      const labelX = x1 + w / 2;
      const shortLabel = b.gobierno.length > 18 ? `${b.gobierno.slice(0, 17)}…` : b.gobierno;
      return `  <rect x="${x1.toFixed(1)}" y="${padTop}" width="${w.toFixed(1)}" height="${plotH}" fill="${fill}" />
  <line x1="${x1.toFixed(1)}" y1="${padTop}" x2="${x1.toFixed(1)}" y2="${padTop + plotH}" stroke="#CDC6B6" stroke-width="1" />
  ${w >= 54 ? `<text x="${labelX.toFixed(1)}" y="${padTop - 10}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="#524E46">${escapeXml(shortLabel)}</text>` : ''}`;
    })
    .join('\n');

  // Rejilla horizontal (4 pasos)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = niceMax * t;
    const y = yOf(val);
    const label = Number.isInteger(val) ? String(val) : val.toFixed(1);
    return `  <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${padLeft + plotW}" y2="${y.toFixed(1)}" stroke="#CDC6B6" stroke-width="0.75" stroke-dasharray="${t === 0 ? 'none' : '2 3'}" />
  <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="10.5" fill="#524E46">${label}</text>`;
  });

  // Etiquetas de años en eje X (hasta 10 marcas legibles)
  const stepX = Math.max(1, Math.ceil(rows.length / 10));
  const xTicks = rows
    .filter((_, idx) => idx % stepX === 0 || idx === rows.length - 1)
    .map((r) => {
      const x = xOf(r.anio);
      return `  <line x1="${x.toFixed(1)}" y1="${padTop + plotH}" x2="${x.toFixed(1)}" y2="${padTop + plotH + 5}" stroke="#171614" stroke-width="1" />
  <text x="${x.toFixed(1)}" y="${padTop + plotH + 19}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10.5" fill="#171614">${r.anio}</text>`;
    });

  const points = rows.map((r) => `${xOf(r.anio).toFixed(1)},${yOf(r.valor).toFixed(1)}`).join(' ');
  const dots = rows
    .map(
      (r) =>
        `  <circle cx="${xOf(r.anio).toFixed(1)}" cy="${yOf(r.valor).toFixed(1)}" r="3.2" fill="#171614"><title>${r.anio} (${escapeXml(r.gobierno)}): ${r.valor} ${escapeXml(r.unidad)}</title></circle>`,
    )
    .join('\n');

  const strokeColor = series.variaPorGobierno ? '#8C1D18' : '#171614';

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(series.titulo)} (${minYear}–${maxYear})" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#F6F3EC" />
${bandRects}
${yTicks.join('\n')}
  <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#171614" stroke-width="1.2" />
  <line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#171614" stroke-width="1.2" />
${xTicks.join('\n')}
  ${rows.length > 1 ? `<polyline fill="none" stroke="${strokeColor}" stroke-width="2" points="${points}" />` : ''}
${dots}
  <text x="${padLeft}" y="${height - 10}" font-family="IBM Plex Sans, sans-serif" font-size="10.5" fill="#524E46">Unidad: ${escapeXml(series.unidad)} · Bandas alternas: cambios de gobierno (sin colores de partido)</text>
</svg>`;
}

/**
 * Barra SVG monocroma en compilación para el resultado global de una votación parlamentaria.
 */
export function renderVotacionSvg(votacion: Votacion): string {
  const { a_favor, en_contra, abstenciones } = votacion.resultado;
  const total = Math.max(1, a_favor + en_contra + abstenciones);
  const width = 640;
  const barH = 26;
  const wFavor = (a_favor / total) * width;
  const wAbst = (abstenciones / total) * width;
  const wContra = (en_contra / total) * width;

  return `<svg viewBox="0 0 ${width} 60" role="img" aria-label="Resultado de votación: ${a_favor} a favor, ${abstenciones} abstenciones, ${en_contra} en contra" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="hatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#171614" stroke-width="1.5" />
    </pattern>
  </defs>
  <rect x="0" y="6" width="${wFavor.toFixed(1)}" height="${barH}" fill="#171614" />
  <rect x="${wFavor.toFixed(1)}" y="6" width="${wAbst.toFixed(1)}" height="${barH}" fill="url(#hatch)" stroke="#171614" stroke-width="1" />
  <rect x="${(wFavor + wAbst).toFixed(1)}" y="6" width="${wContra.toFixed(1)}" height="${barH}" fill="#F6F3EC" stroke="#171614" stroke-width="1.2" />
  <text x="0" y="50" font-family="IBM Plex Mono, monospace" font-size="11.5" fill="#171614">■ A favor: ${a_favor}   ▤ Abstenciones: ${abstenciones}   □ En contra: ${en_contra}</text>
</svg>`;
}
