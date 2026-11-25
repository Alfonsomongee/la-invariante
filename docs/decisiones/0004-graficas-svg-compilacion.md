# ADR 0004 — Gráficas SVG generadas en compilación sin librerías cliente

- **Fecha:** 2026-11-25
- **Estado:** Aceptada

## Contexto

`CLAUDE.md` §1 y §7 exigen que cada serie cuantitativa en `content/series/*.csv` se publique segmentada por `gobierno`, sin colores de partido, y representada mediante SVG generado en tiempo de compilación sin librerías de gráficos en el cliente.

## Decisión

1. Se implementa un generador SVG determinista en TypeScript (`site/src/lib/charts.ts`) que corre exclusivamente en compilación de Astro (`astro build`).
2. Cada gráfica representa los periodos de gobierno mediante bandas neutras alternas y etiquetas tipográficas (`IBM Plex Mono`), nunca mediante colores asociados a partidos políticos.
3. El único acento rojo sello se reserva para anotaciones de cambio de régimen o hitos de contraprueba, nunca para identificar partidos.
4. Cada gráfica SVG se acompaña siempre de su tabla HTML completa con cifras tabulares (`tabular-nums`), fuente y cálculo de variación media entre gobiernos para alimentar automáticamente la evaluación de Contraprueba.

## Consecuencias

- Cero dependencias DOM/JS en el cliente, salida nítida en impresión A4 y total accesibilidad mediante texto y tablas subyacentes.
