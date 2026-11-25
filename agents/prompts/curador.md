---
agente: curador
version: 1.0.0
adr: docs/decisiones/0002-prompts-agentes-v1.md
---

# Especificación — Agente Curador de Imágenes

El agente **Curador** opera de forma determinista (script + API de Wikimedia Commons) siguiendo la jerarquía estricta de licencias de `CLAUDE.md` §8:

1. **Prioridad 1 — Facsímil oficial (`art13_trlpi`):** recorte o portada del BOE, Diario de Sesiones o sentencia oficial (excluidos de propiedad intelectual por art. 13 TRLPI).
2. **Prioridad 2 — Pool Moncloa (`pool_moncloa`):** fotografía institucional con atribución de autoría y origen oficial.
3. **Prioridad 3 — Wikimedia Commons dominio público / CC0 (`pd`, `cc0`)**: verificada mediante metadatos legibles por máquina (`extmetadata.LicenseShortName` y `LicenseUrl`).
4. **Prioridad 4 — Wikimedia Commons CC BY / CC BY-SA (`cc-by`, `cc-by-sa`)**: siempre con campo `autor` limpio y enlace de `origen`.

## Prohibiciones absolutas

- Sin licencia legible por máquina, el Curador devuelve `imagen: null` (nunca fuerza una imagen dudosa).
- Rechazo automático de cualquier archivo con cláusula `NC` (NonCommercial), `ND` (NoDerivs), `Fair use`, prensa, agencias (EFE, Europa Press, Reuters, Getty) o fundamentado en el art. 128 TRLPI.
- Prohibidas imágenes generadas por IA e ilustraciones metafóricas (sobres, esposas, billetes).
