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
  <rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" />
  <rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" rx="8" fill="#F3F3F0" />
  <text x="${width / 2}" y="${height / 2 - 4}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" fill="#71716B">Serie preparada (0 observaciones publicadas todavía)</text>
  <text x="${width / 2}" y="${height / 2 + 18}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#71716B">Archivo fuente: content/series/${escapeXml(series.archivo)}</text>
</svg>`;
  }

  const rows = [...series.rows].sort((a, b) => a.anio - b.anio);
  const minYear = rows[0].anio;
  const maxYear = rows[rows.length - 1].anio;
  const maxVal = Math.max(...rows.map((r) => r.valor), 1);
  const niceMax = Math.ceil(maxVal * 1.12 * 10) / 10;

  // Posición X subanual cuando un mismo año tiene dos gobiernos (p. ej. años de relevo o 1977)
  const countByYear = new Map<number, number>();
  for (const r of rows) {
    countByYear.set(r.anio, (countByYear.get(r.anio) ?? 0) + 1);
  }
  const seenByYear = new Map<number, number>();
  const xVals = rows.map((r) => {
    const totalInYear = countByYear.get(r.anio) ?? 1;
    const idxInYear = seenByYear.get(r.anio) ?? 0;
    seenByYear.set(r.anio, idxInYear + 1);
    return totalInYear === 1 ? r.anio : r.anio + (idxInYear + 0.5) / totalInYear - 0.5;
  });

  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);
  const xCoords = rows.map((_, i) => {
    if (rows.length === 1) return padLeft + plotW / 2;
    if (minYear === maxYear) {
      return padLeft + ((i + 0.5) / rows.length) * plotW;
    }
    const span = Math.max(1, maxX - minX);
    return padLeft + ((xVals[i] - minX) / span) * plotW;
  });

  const yOf = (val: number) => padTop + plotH - (val / niceMax) * plotH;

  // Segmentos contiguos por gobierno (bandas neutras alternas, SIN colores de partido)
  interface Band {
    gobierno: string;
    startIdx: number;
    endIdx: number;
    idx: number;
  }
  const bands: Band[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = bands[bands.length - 1];
    if (prev && prev.gobierno === r.gobierno) {
      prev.endIdx = i;
    } else {
      bands.push({
        gobierno: r.gobierno,
        startIdx: i,
        endIdx: i,
        idx: bands.length,
      });
    }
  }

  const bandRects = bands
    .map((b) => {
      const x1 =
        b.startIdx === 0
          ? padLeft
          : (xCoords[b.startIdx - 1] + xCoords[b.startIdx]) / 2;
      const x2 =
        b.endIdx === rows.length - 1
          ? padLeft + plotW
          : (xCoords[b.endIdx] + xCoords[b.endIdx + 1]) / 2;
      const w = Math.max(4, x2 - x1);
      const fill = b.idx % 2 === 0 ? '#F3F3F0' : '#FFFFFF';
      const labelX = x1 + w / 2;
      const shortLabel = b.gobierno.length > 22 ? `${b.gobierno.slice(0, 21)}…` : b.gobierno;
      return `  <rect x="${x1.toFixed(1)}" y="${padTop}" width="${w.toFixed(1)}" height="${plotH}" fill="${fill}" />
  <line x1="${x1.toFixed(1)}" y1="${padTop}" x2="${x1.toFixed(1)}" y2="${padTop + plotH}" stroke="#E5E5E0" stroke-width="1" />
  ${w >= 54 ? `<text x="${labelX.toFixed(1)}" y="${padTop - 10}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="#71716B">${escapeXml(shortLabel)}</text>` : ''}`;
    })
    .join('\n');

  // Rejilla horizontal (4 pasos)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = niceMax * t;
    const y = yOf(val);
    const label = Number.isInteger(val) ? String(val) : val.toFixed(1);
    return `  <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${padLeft + plotW}" y2="${y.toFixed(1)}" stroke="#E5E5E0" stroke-width="0.75" stroke-dasharray="${t === 0 ? 'none' : '2 3'}" />
  <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="10.5" fill="#71716B">${label}</text>`;
  });

  // Etiquetas en eje X (hasta 10 marcas legibles; desdobla etiquetas si solo hay un año con dos gobiernos)
  const stepX = Math.max(1, Math.ceil(rows.length / 10));
  const seenTickYears = new Set<number>();
  const xTicks = rows
    .map((r, idx) => ({ r, idx, x: xCoords[idx] }))
    .filter(({ r, idx }) => {
      if (minYear === maxYear) return true;
      if (seenTickYears.has(r.anio)) return false;
      const keep = idx % stepX === 0 || idx === rows.length - 1;
      if (keep) seenTickYears.add(r.anio);
      return keep;
    })
    .map(({ r, x }) => {
      const label =
        minYear === maxYear ? `${r.anio} (${r.partido_gobierno})` : String(r.anio);
      return `  <line x1="${x.toFixed(1)}" y1="${padTop + plotH}" x2="${x.toFixed(1)}" y2="${padTop + plotH + 5}" stroke="#111110" stroke-width="1" />
  <text x="${x.toFixed(1)}" y="${padTop + plotH + 19}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10.5" fill="#111110">${escapeXml(label)}</text>`;
    });

  const points = rows.map((r, idx) => `${xCoords[idx].toFixed(1)},${yOf(r.valor).toFixed(1)}`).join(' ');
  const dots = rows
    .map(
      (r, idx) =>
        `  <circle cx="${xCoords[idx].toFixed(1)}" cy="${yOf(r.valor).toFixed(1)}" r="3.4" fill="#111110"><title>${r.anio} (${escapeXml(r.gobierno)}): ${r.valor} ${escapeXml(r.unidad)}</title></circle>`,
    )
    .join('\n');

  const strokeColor = series.variaPorGobierno ? '#991B1B' : '#111110';

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(series.titulo)} (${minYear}–${maxYear})" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" />
${bandRects}
${yTicks.join('\n')}
  <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#D4D4CE" stroke-width="1" />
  <line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#111110" stroke-width="1" />
${xTicks.join('\n')}
  ${rows.length > 1 ? `<polyline fill="none" stroke="${strokeColor}" stroke-width="2" points="${points}" />` : ''}
${dots}
  <text x="${padLeft}" y="${height - 10}" font-family="IBM Plex Sans, sans-serif" font-size="10.5" fill="#71716B">Unidad: ${escapeXml(series.unidad)} · Bandas alternas: cambios de gobierno (sin colores de partido)</text>
</svg>`;
}

/**
 * Barra SVG monocroma en compilación para el resultado global de una votación parlamentaria.
 */
export function renderVotacionSvg(votacion: Votacion): string {
  const { a_favor, en_contra, abstenciones, nulos = 0 } = votacion.resultado;
  const total = Math.max(1, a_favor + en_contra + abstenciones + nulos);
  const width = 640;
  const barH = 22;
  const wFavor = (a_favor / total) * width;
  const wAbst = (abstenciones / total) * width;
  const wContra = (en_contra / total) * width;
  const wNulos = (nulos / total) * width;
  const nuloText = nulos > 0 ? `   × Nulos: ${nulos}` : '';

  return `<svg viewBox="0 0 ${width} 56" role="img" aria-label="Resultado de votación: ${a_favor} a favor, ${abstenciones} abstenciones, ${en_contra} en contra${nulos > 0 ? `, ${nulos} nulos` : ''}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="hatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#111110" stroke-width="1.3" />
    </pattern>
  </defs>
  <rect x="0" y="6" width="${wFavor.toFixed(1)}" height="${barH}" rx="4" fill="#111110" />
  <rect x="${wFavor.toFixed(1)}" y="6" width="${wAbst.toFixed(1)}" height="${barH}" fill="url(#hatch)" stroke="#111110" stroke-width="1" />
  <rect x="${(wFavor + wAbst).toFixed(1)}" y="6" width="${wContra.toFixed(1)}" height="${barH}" fill="#FFFFFF" stroke="#111110" stroke-width="1" />
  ${nulos > 0 ? `<rect x="${(wFavor + wAbst + wContra).toFixed(1)}" y="6" width="${Math.max(2, wNulos).toFixed(1)}" height="${barH}" fill="#991B1B" />` : ''}
  <text x="0" y="48" font-family="IBM Plex Mono, monospace" font-size="11.5" fill="#4A4A46">■ A favor: ${a_favor}   ▤ Abstenciones: ${abstenciones}   □ En contra: ${en_contra}${nuloText}</text>
</svg>`;
}
