# ADR 0002 — Prompts iniciales v1 de agentes y separación de modelos

- **Fecha:** 2026-11-25
- **Estado:** Aceptada

## Contexto

`CLAUDE.md` §6 establece que cada agente dispone de un prompt versionado en `agents/prompts/*.md`, que cualquier modificación de un prompt exige un ADR y que el **Verificador** debe usar un modelo de lenguaje distinto al del **Extractor** para evitar sesgos de confirmación compartidos.

## Decisión

1. Se crean los prompts v1.0.0 en `agents/prompts/`:
   - `investigador-anuario.md` (plantilla generalizada por año basada en `anuario-1985.md`).
   - `extractor.md` (extracción estricta a YAML en `borrador` con página y fragmento por afirmación).
   - `verificador.md` (auditoría adversarial orientada a refutar la ficha y detectar fuentes débiles).
   - `jurista.md` (revisión de estado procesal, presunción de inocencia, STC 58/2018 y art. 13 TRLPI).
   - `editor.md` (redacción neutra de título y resumen ≤ 60 palabras sin adjetivos valorativos).
   - `curador.md` (selección verificable de facsímil o imagen con licencia legible por máquina).
   - `vigilante.md` (detección mensual de cambios procesales en fichas abiertas).
   - `auditor.md` (especificación del informe determinista de cobertura y huecos).
2. El cliente de agentes (`agents/lib/llm.ts`) exige en tiempo de ejecución que `VERIFICADOR_MODEL` (o `VERIFICADOR_PROVIDER`) difiera de `EXTRACTOR_MODEL` / `EXTRACTOR_PROVIDER`, abortando si coinciden.
3. Todos los agentes soportan modo `--prompt-only` / `--dry-run` para revisión manual o ejecución supervisada sin claves API locales.

## Consecuencias

- Toda evolución futura de los prompts quedará documentada en un nuevo ADR en `docs/decisiones/`.
- Ningún agente dispone de permisos ni código para fusionar PRs o escribir directamente en `main`.
