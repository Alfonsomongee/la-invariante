# ADR 0003 — JavaScript de cliente restringido a Pagefind en `/buscar`

- **Fecha:** 2026-11-25
- **Estado:** Aceptada

## Contexto

`CLAUDE.md` §7 establece el uso de **Pagefind** para la búsqueda interna de la web estática, y §11 exige que no se añada JavaScript de cliente sin un ADR que lo justifique. Asimismo, §8 impone que los nombres con `cargo_publico: false` no se indexen en el buscador interno.

## Decisión

1. Todas las páginas del sitio (portada, anuarios, fichas, promesas, votaciones, series, contraprueba, metodología, personas, erratas y rectificación) se entregan como **HTML y CSS puro con 0 bytes de JavaScript de cliente**.
2. Únicamente la página `/buscar/` carga el script estático generado por Pagefind (`/pagefind/pagefind-ui.js` y `/pagefind/pagefind-ui.css`) durante `npm run build`.
3. Todas las menciones a personas con `cargo_publico: false` se envuelven en el atributo `data-pagefind-ignore="all"` para excluirlas del índice de búsqueda en compilación.
4. La página `/buscar/` incluye un enlace alternativo navegable por índices estáticos (`/anuarios`, `/fichas`, `/partidos`) para usuarios sin JavaScript.

## Consecuencias

- Se cumple simultáneamente el requisito de búsqueda estática con Pagefind y la disciplina de cero JS de cliente en el resto del archivo.
- Ningún componente interactivo adicional podrá introducir JS de cliente sin aprobar un nuevo ADR.
