# CLAUDE.md — La Invariante

Archivo hemerográfico y documental del fallo sistémico en España, 1977–hoy.
Este fichero manda sobre cualquier otra instrucción del repositorio. Léelo entero antes de tocar nada.

---

## 1. Qué es el proyecto

Una web estática que registra, año a año, hechos documentados sobre el funcionamiento de las instituciones españolas desde 1977: corrupción judicializada, promesas revertidas, puertas giratorias, gobierno por decreto, colonización de órganos de control, socialización de pérdidas, etc.

**Tesis (falsable):** la alternancia de partidos no altera la frecuencia de un conjunto definido de conductas, porque dependen de reglas que ningún partido ha cambiado (listas cerradas, financiación de partidos, administración politizada, nombramientos por cuota).

**Consecuencia para el código y el contenido:**

- Cada indicador se publica como serie por gobierno. Si la serie cambia con el gobierno, la web lo dice. La sección **Contraprueba** es obligatoria, no decorativa.
- La web no pide el voto ni la abstención. No concluye por el lector. Presenta hechos con el mismo criterio para todos los partidos.

## 2. Reglas editoriales (no negociables)

1. **Sin documento primario no hay ficha.** Fuente primaria = BOE, sentencia o auto, Diario de Sesiones, informe del Tribunal de Cuentas, nota oficial, programa electoral. La prensa sirve para localizar y contextualizar, nunca como única prueba.
2. **Mismo criterio de entrada para todos los partidos.** Ver `docs/METODOLOGIA.md`. Ningún agente puede relajar el criterio para «completar» un partido.
3. **Estado procesal exacto.** Se usa solo la escala cerrada de la sección 5. Nunca escalar la gravedad respecto al documento.
4. **Archivos y absoluciones con la misma visibilidad que la imputación.** Si una causa termina a favor del afectado, la ficha cambia de estado y lo dice en su primera línea.
5. **Descargo obligatorio** cuando exista: versión del afectado, recurso, resolución favorable.
6. **Cero adjetivos valorativos** en títulos y resúmenes. Lista negra en `scripts/estilo/adjetivos.txt` (escandaloso, vergonzoso, polémico, brutal, demoledor, histórico, bochornoso, opaco, turbio, etc.). El linter falla si aparece alguno.
7. **Resumen de 60 palabras como máximo.** Sujeto, verbo, objeto, fecha, cifra. Verbos del documento: «condenó», «archivó», «investiga», «aprobó».
8. **Cifras con su contexto:** fuente, año y tipo de euro (`euros corrientes de AAAA`). Antes de 2002, importe original en pesetas y conversión a 166,386 ptas/€, indicándolo. Deflactar con IPC del INE solo en campo aparte (`valor_eur_reales_AAAA`).
9. **Nada de citas largas de prensa.** De la prensa: dato y enlace. Las citas largas solo de documentos oficiales (art. 13 TRLPI: no protegidos).
10. **Ningún agente publica.** Todo entra por pull request y lo fusiona una persona.

## 3. Estructura del repositorio

```
/
├── CLAUDE.md
├── docs/
│   ├── METODOLOGIA.md          # criterios de entrada, estados, objeciones y respuestas
│   └── decisiones/             # ADR cortos: una decisión por fichero
├── content/
│   ├── fichas/AAAA/ID.yaml     # unidad básica
│   ├── promesas/AAAA/ID.yaml   # formato Dijo / Firmó
│   ├── votaciones/AAAA/ID.yaml # «Votan juntos»
│   ├── anuarios/AAAA.yaml      # contexto del año: gobierno, legislatura, composición
│   └── series/*.csv            # indicadores con columna `gobierno`
├── schema/
│   ├── ficha.schema.json
│   ├── promesa.schema.json
│   └── votacion.schema.json
├── agents/
│   ├── prompts/                # un .md por agente; versionados
│   ├── recolectores/           # un script por fuente, sin LLM
│   ├── extractor/
│   ├── verificador/
│   ├── jurista/
│   ├── editor/
│   ├── curador/
│   ├── vigilante/
│   └── auditor/
├── scripts/
│   ├── validate.ts             # JSON Schema + reglas cruzadas
│   └── estilo/                 # linter de adjetivos y longitud
├── site/                       # Astro
└── .github/workflows/          # cron de recolectores, validación en PR, despliegue
```

Documentos originales: **no** se guardan en Git. Se suben a almacenamiento de objetos (Cloudflare R2) con nombre = `sha256`. La ficha guarda URL de origen, `sha256` y fecha de captura. Si hay URL pública, además se archiva en la Wayback Machine.

## 4. Identificadores

`ES-AAAA-CAT-NNN`, donde `AAAA` es el año del hecho principal y `CAT`:

| Código | Categoría |
| --- | --- |
| COR | Corrupción judicializada |
| FIN | Financiación de partidos |
| PRM | Promesa frente a BOE |
| VOT | Cuando todos votan juntos |
| GRA | Gracia e impunidad (indulto, amnistía, prescripción) |
| PGI | Puertas giratorias |
| SOC | Socialización de pérdidas |
| CTL | Colonización de órganos de control |
| DEC | Gobierno por decreto-ley |
| LMD | Leyes a medida |
| LEN | Justicia lenta como impunidad |
| CRI | Fallos de Estado en crisis |
| SOB | Soberanía y cesiones |
| DET | Deterioro acumulado |

Los ID no se reutilizan nunca. Una ficha retirada queda con `estado_ficha: retirada` y motivo.

## 5. Modelo de datos

### Ficha (resumen; el esquema completo manda)

```yaml
id: ES-AAAA-CAT-NNN
anuario: AAAA
categoria: COR
partidos: [PSOE]               # siglas del momento de los hechos
nivel: estatal | autonomico | local
protagonistas:
  - nombre: ...
    cargo_en_el_momento: ...
    cargo_publico: true         # false => noindex por nombre (ver §8)
    wikidata: Q...
estado_procesal:
  actual: condenado_firme
  historial:
    - {fecha: AAAA-MM-DD, estado: investigado, documento: <url>}
titulo: ...                     # sin adjetivos
resumen: ...                    # ≤ 60 palabras
descargo: ...                   # o null
cifras:
  - {concepto: ..., valor: ..., moneda: ESP|EUR, anio_moneda: AAAA, fuente: <url>}
fuentes:
  - {tipo: boe|sentencia|auto|diario_sesiones|tcu|oficial|programa|prensa,
     url: ..., sha256: ..., capturado: AAAA-MM-DD, pagina: N, fragmento: "..."}
imagen:
  tipo: facsimil|foto
  licencia: art13_trlpi|pool_moncloa|pd|cc0|cc-by|cc-by-sa
  autor: ...
  origen: <url>
estado_ficha: borrador|revision|publicada|retirada
versiones:
  - {fecha: AAAA-MM-DD, cambio: ..., motivo: ...}
```

Regla cruzada: toda afirmación del `resumen` debe poder emparejarse con un `fragmento` de `fuentes`. `validate.ts` lo comprueba por cobertura de entidades y cifras.

### Escala cerrada de estado procesal

| Valor | Documento que lo acredita | Etiqueta en la web |
| --- | --- | --- |
| `denunciado` | Auto de admisión | Investigación abierta |
| `investigado` | Auto de imputación | Investigado (presunción de inocencia) |
| `acusado` | Auto de apertura de juicio oral o procesamiento | Acusado |
| `condenado_no_firme` | Sentencia recurrible | Condenado en primera instancia |
| `condenado_firme` | Sentencia firme | Condenado |
| `absuelto` | Sentencia | Absuelto |
| `archivado` | Auto de sobreseimiento | Archivado |
| `extinguido` | Auto (salud, fallecimiento, prescripción) | Sin juicio: motivo |
| `indultado` / `amnistiado` | BOE | Condenado e indultado / amnistiado |
| `sancion_administrativa` | Resolución TCu u órgano | Sancionado (no penal) |
| `no_judicial` | — | Hecho documentado sin causa judicial |

**El estado procesal no lo decide un LLM.** El modelo propone; una regla lo valida contra el tipo de documento enlazado. Sin documento del tipo correspondiente, la validación falla.

## 6. Agentes

| Agente | Entrada → salida | Motor | Regla dura |
| --- | --- | --- | --- |
| Recolectores | Fuente → documento + `sha256` | Script, sin LLM | Nunca resumen |
| Extractor | Documento → ficha en `borrador` | LLM de contexto largo | Cada campo con página y fragmento |
| Verificador | Ficha → informe de refutación | LLM **distinto** del extractor | Instrucción: buscar lo que la tumba |
| Jurista | Ficha → estado procesal + léxico | Reglas + LLM | Ver §5 y §8 |
| Editor | Ficha → título y resumen finales | LLM de redacción | Pasa el linter de estilo |
| Curador | Ficha → imagen con licencia | Script + API de Commons | Sin licencia legible por máquina, nada |
| Vigilante | Fichas abiertas → nueva versión | Cron mensual | Cambio de estado = PR nuevo |
| Auditor | Archivo → informe de cobertura | Script | Los huecos generan búsquedas, no fichas |

Flujo: cada ficha candidata abre un PR con etiqueta `ficha`. El PR incluye el informe del verificador y el del jurista como comentario. Fusionar = publicar.

Prompts en `agents/prompts/*.md`. Cambiar un prompt exige ADR en `docs/decisiones/`.

## 7. Web

- **Astro** + colecciones de contenido sobre `content/`. Salida estática.
- **Pagefind** para búsqueda.
- Gráficas: SVG en compilación (Observable Plot o a mano). Sin librerías de gráficos en el cliente.
- Tarjetas sociales con **Satori** desde la ficha: fecha, título, recorte del documento.
- Hoja de estilo de impresión: ficha limpia en A4 con URL y fecha de consulta.
- Despliegue: Cloudflare Pages (o Vercel) desde `main`.

### Sistema visual

- Fondo hueso, tinta casi negra; contraste AA mínimo.
- **Sin colores de partido.** El partido es texto y filtro.
- Un solo acento (rojo sello) para estado procesal y cambios de estado.
- Serifa de lectura (Source Serif 4 o Newsreader), mono para códigos y referencias (IBM Plex Mono), sans con cifras tabulares para datos.
- Medida de 60–70 caracteres; fuentes en notas al margen (en móvil, plegadas).

### Prohibido en la interfaz

Imágenes generadas por IA · ilustraciones de sobres, esposas o billetes · degradados · efecto cristal · sombras flotantes · emoji · contadores animados · héroe con eslogan · adjetivos en titulares · textos de relleno.

## 8. Reglas jurídicas en el código

- `cargo_publico: false` ⇒ la ficha no indexa ese nombre en el buscador interno y emite `noindex` para buscadores externos en cualquier página que lo destaque (STC 58/2018).
- Solo existen páginas por persona para cargos públicos, y solo con hechos de su cargo.
- Cada ficha muestra enlace de réplica/rectificación.
- `CHANGELOG` público de fichas generado desde el historial de Git (fe de erratas).
- Imágenes: prioridad facsímil (art. 13 TRLPI) > Pool Moncloa > Commons PD/CC0 > Commons CC BY/BY-SA con atribución. Prohibido: agencia, prensa, NC, ND. No apoyarse en el art. 128 (meras fotografías).

## 9. Comandos (a crear en la fase 0)

```
npm run validate        # esquemas + reglas cruzadas sobre content/
npm run lint:estilo     # adjetivos, longitud, léxico procesal
npm run dev             # site/ en local
npm run build           # web estática + índice de Pagefind
npm run agent -- <nombre> --fuente <id> --anio AAAA
```

CI: todo PR ejecuta `validate` y `lint:estilo`. Un PR de ficha que falle no se puede fusionar.

## 10. Entorno

- El mantenedor **no tiene permisos de administrador** en su ordenador. Nada de instaladores de sistema: dependencias por `npm`/`npx` en el proyecto, y trabajo pesado en GitHub Actions o en la nube.
- Secretos (claves de API de modelos) solo en GitHub Secrets. Nunca en el repositorio.

## 11. Definición de «hecho»

Una ficha está lista cuando:

- [ ] valida contra el esquema;
- [ ] pasa el linter de estilo;
- [ ] cada afirmación del resumen tiene fragmento de fuente;
- [ ] el estado procesal coincide con el tipo de documento enlazado;
- [ ] tiene descargo o `descargo: null` justificado en el PR;
- [ ] la imagen tiene licencia y autor;
- [ ] una persona la ha leído junto al documento original.

Un cambio de código está listo cuando pasa CI, no rompe la impresión de ficha y no añade JavaScript de cliente sin ADR.

## 12. Cuando dudes

- Si un dato no tiene fuente primaria: no lo inventes, déjalo como `pendiente` y explícalo en el PR.
- Si un caso favorece la tesis pero el documento es débil: fuera.
- Si un caso contradice la tesis: dentro, y enlazado desde Contraprueba.
