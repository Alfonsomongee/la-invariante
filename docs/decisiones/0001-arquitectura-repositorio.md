# ADR 0001 — Arquitectura base del repositorio y publicación estática

- **Fecha:** 2026-11-25
- **Estado:** Aceptada

## Contexto

La Invariante requiere un repositorio auditable, versionado en Git, desplegable como sitio estático sin servidor de aplicaciones y mantenible desde equipos sin permisos de administrador local (`CLAUDE.md` §3, §7 y §10). Los documentos primarios (PDF del BOE, sentencias, autos) pueden ocupar gigabytes y no deben inflar el historial de Git.

## Decisión

1. **Contenido declarativo en Git (`content/`):** fichas, promesas, votaciones y anuarios en YAML; series cuantitativas en CSV con columna obligatoria `gobierno`.
2. **Esquemas formales (`schema/`):** JSON Schema Draft-07 validados con `Ajv` más reglas cruzadas en `scripts/validate.ts`.
3. **Documentos binarios fuera de Git:** almacenados en Cloudflare R2 bajo clave `<sha256>`, conservando en cada ficha únicamente URL de origen, `sha256`, fecha de captura, copia en Wayback Machine y fragmento literal.
4. **Web estática (`site/`):** Astro en modo estático (`output: 'static'`) en un workspace npm, sin instaladores de sistema ni permisos de administrador.
5. **Publicación exclusiva mediante PR:** los agentes generan borradores o propuestas en ramas y abren pull requests; CI bloquea cualquier fusión que incumpla `validate` o `lint:estilo`.

## Consecuencias

- Todo el historial editorial y fe de erratas (`/erratas`) se deriva directamente de `git log`.
- La web es replicable en cualquier alojamiento estático (Cloudflare Pages, Vercel o servidor propio) y apta para impresión A4.
- El flujo local depende únicamente de Node.js y `npm`/`npx`.
