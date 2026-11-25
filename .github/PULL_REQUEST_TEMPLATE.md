## Resumen del cambio

- **Tipo:** [ ] Ficha (`ficha`) · [ ] Promesa (`PRM`) · [ ] Votación (`VOT`) · [ ] Anuario · [ ] Serie CSV · [ ] Código / ADR
- **Identificador(es) / Año:**

## Definición de «hecho» para fichas (`CLAUDE.md` §11)

- [ ] Valida contra el esquema y reglas cruzadas (`npm run validate`).
- [ ] Pasa el linter de estilo sin adjetivos valorativos y ≤ 60 palabras (`npm run lint:estilo`).
- [ ] Cada afirmación, fecha, cifra y entidad del resumen tiene `fragmento` literal en `fuentes` primarias.
- [ ] El `estado_procesal` coincide exactamente con el tipo de documento enlazado (y si es `absuelto`/`archivado`/`extinguido`, consta en la primera oración del resumen).
- [ ] Tiene `descargo` o `descargo: null` justificado aquí abajo.
- [ ] Si hay personas sin cargo público, constan con `cargo_publico: false` (STC 58/2018).
- [ ] Si lleva imagen, tiene licencia permitida (`art13_trlpi`, `pool_moncloa`, `pd`, `cc0`, `cc-by`, `cc-by-sa`) y autoría; si no, `imagen: null`.
- [ ] **Revisión humana:** una persona ha contrastado esta ficha directamente frente al documento primario original.

## Justificación de `descargo: null` (si aplica)

_Indica qué se buscó y por qué no existe descargo o recurso conocido._

## Cambios de código / prompts (si aplica)

- [ ] Pasa CI (`validate`, `lint:estilo`, `test`, `build`).
- [ ] No rompe la hoja de impresión A4 de ficha.
- [ ] Si cambia algún prompt en `agents/prompts/` o añade JS de cliente, incluye ADR en `docs/decisiones/`.
