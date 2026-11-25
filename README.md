# La Invariante

Archivo hemerográfico y documental del funcionamiento de las instituciones españolas desde 1977 hasta hoy.

Todas las reglas editoriales, jurídicas y técnicas del proyecto se rigen por [CLAUDE.md](CLAUDE.md) y [docs/METODOLOGIA.md](docs/METODOLOGIA.md).

## Requisitos (sin permisos de administrador)

- Node.js `>= 20.18.0` y `npm`
- Git

Instalación local (solo dependencias de proyecto en `node_modules/`):

```bash
npm install
```

## Comandos principales

```bash
npm run validate        # Valida JSON Schema + reglas cruzadas + series CSV sobre content/
npm run lint:estilo     # Linter de adjetivos valorativos, longitud (≤60 palabras) y léxico procesal
npm test                # Pruebas automatizadas de validador, linter y agentes
npm run typecheck       # Comprobación de tipos en scripts, agents y site/
npm run dev             # Servidor local de Astro (site/)
npm run build           # Web estática (Astro + SVG + tarjetas OG Satori) + índice Pagefind
npm run agent -- help   # CLI unificada de agentes
```

## Flujo de trabajo año a año (1977–hoy)

1. **Preparar el expediente del año** (ejemplo: 1985):
   ```bash
   npm run agent -- anuario --anio 1985 --prompt-only
   npm run agent -- auditor --anio 1985
   ```
2. **Recolectar documentos primarios** (scripts sin LLM, calculan `sha256`, suben a R2 si está configurado y archivan en Wayback Machine):
   ```bash
   npm run agent -- recolector --fuente boe --anio 1985
   npm run agent -- recolector --fuente boe --boe-id BOE-A-1985-11672 --anio 1985 --wayback
   npm run agent -- recolector --fuente url --url "https://..." --anio 1985 --wayback
   ```
3. **Extraer ficha candidata en `borrador`**:
   ```bash
   npm run agent -- extractor --anio 1985 --manifest .cache/manifests/<sha256>.json --tipo ficha
   ```
4. **Verificar (modelo distinto del Extractor), revisar jurídicamente, editar y validar**:
   ```bash
   npm run agent -- verificador --ficha ES-1985-CTL-001
   npm run agent -- jurista --ficha ES-1985-CTL-001
   npm run agent -- editor --ficha ES-1985-CTL-001
   npm run agent -- curador --ficha ES-1985-CTL-001 --facsimil --aplicar
   ```
   O en bloque hasta abrir PR borrador para revisión humana (Regla 10 — ningún agente publica):
   ```bash
   npm run agent -- pipeline --ficha ES-1985-CTL-001 --crear-pr
   ```
   > Todos los agentes LLM admiten `--prompt-only` para ensamblar prompts sin necesidad de claves API locales.

## Secretos y despliegue (GitHub + Vercel o Cloudflare Pages)

Consulta [.env.example](.env.example) para las variables de entorno:

- **Modelos:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` (`EXTRACTOR_MODEL` y `VERIFICADOR_MODEL` deben ser distintos).
- **Documentos primarios (Cloudflare R2):** `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
- **Despliegue en Vercel (recomendado):** el repositorio incluye [`vercel.json`](vercel.json) ya configurado (`npm run build` → `site/dist`). Basta con conectar el repositorio de GitHub en Vercel y definir `SITE_URL` en *Environment Variables*.
- **Despliegue alternativo en Cloudflare Pages:** configurar `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y la variable `CF_PAGES_PROJECT` en GitHub Secrets/Variables.

Para previsualizar en local fichas aún en `borrador` o `revision` antes de aprobar su PR:

```bash
PREVIEW_DRAFTS=true npm run dev
```

## Estructura del repositorio

```text
/
├── CLAUDE.md                 # Reglas rectoras del proyecto
├── docs/
│   ├── METODOLOGIA.md        # Criterios de entrada, escala procesal y respuestas a objeciones
│   └── decisiones/           # ADRs cortos (arquitectura, prompts, Pagefind, gráficas SVG)
├── content/
│   ├── fichas/AAAA/ID.yaml
│   ├── promesas/AAAA/ID.yaml
│   ├── votaciones/AAAA/ID.yaml
│   ├── anuarios/AAAA.yaml
│   └── series/*.csv
├── schema/                   # JSON Schema Draft-07
├── agents/                   # Prompts versionados, recolectores sin LLM y agentes
├── scripts/                  # Validador cruzado y linter de estilo
├── tests/                    # Suite de pruebas automatizadas
├── site/                     # Astro estático + Satori OG + SVG + Pagefind + impresión A4
└── .github/workflows/        # CI, revisión de PR, recolectores, vigilante mensual y despliegue
```
