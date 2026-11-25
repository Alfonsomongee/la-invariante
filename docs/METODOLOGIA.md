# Metodología — La Invariante

Este documento define las reglas de entrada, clasificación, verificación, redacción y revisión jurídica de **La Invariante** (1977–hoy). Es el desarrollo operativo de `CLAUDE.md` y se aplica por igual a todos los partidos, gobiernos y niveles territoriales.

---

## 1. Tesis falsable y sección Contraprueba

**Tesis:** la alternancia de partidos en España no altera de forma sustantiva la frecuencia de un conjunto definido de conductas institucionales (uso del decreto-ley, indultos en delitos de corrupción, nombramientos discrecionales en órganos de control, puertas giratorias, financiación irregular, reversión de promesas electorales), porque responden a incentivos y reglas que ningún partido ha reformado (listas cerradas y bloqueadas, financiación de partidos, administración politizada y nombramientos por cuota).

**Condición de falsabilidad:**

- Todas las series cuantitativas se publican desagregadas por **gobierno** y **partido en el Ejecutivo**.
- Si una serie varía de forma apreciable entre gobiernos, la web lo señala de manera explícita.
- La sección **Contraprueba** es obligatoria y aplica el mismo estándar probatorio que el resto del archivo. Registra sentencias, normas, instituciones o períodos en los que un contrapeso funcionó, una reforma redujo la discrecionalidad o un cambio de gobierno alteró la tendencia de un indicador.
- La Invariante no pide el voto ni la abstención ni concluye por el lector.

---

## 2. Regla documental primaria

1. **Sin documento primario no hay ficha.** Se consideran documentos primarios:
   - Boletín Oficial del Estado (`boe`) y boletines autonómicos o provinciales (`oficial`).
   - Sentencias (`sentencia`) y autos judiciales (`auto`), preferentemente vía CENDOJ o repositorio oficial del tribunal.
   - Diario de Sesiones del Congreso, del Senado o de parlamentos autonómicos (`diario_sesiones`).
   - Informes de fiscalización y resoluciones del Tribunal de Cuentas (`tcu`) y órganos autonómicos equivalentes.
   - Otros documentos oficiales: BORME, INE, Banco de España, Tribunal Constitucional, CGPJ, memorias de la Fiscalía (`oficial`).
   - Programas electorales oficiales depositados o archivados (`programa`).
2. **Función de la prensa (`prensa`):** sirve únicamente para localizar fechas, nombres o expedientes y aportar contexto accesorio. Nunca basta como fuente única. No se reproducen citas largas de prensa; solo dato factual y enlace. Las citas extensas proceden únicamente de documentos oficiales no protegidos por derechos de autor (art. 13 TRLPI).
3. **Integridad criptográfica y preservación:** los archivos originales no se almacenan en Git. Se suben a almacenamiento de objetos (Cloudflare R2) nombrados por su huella `sha256`. Cada ficha registra URL de origen, `sha256`, fecha de captura, página y fragmento literal, más copia en Wayback Machine cuando la URL es pública.

---

## 3. Criterios mínimos de entrada por categoría

El identificador sigue el formato inmutable `ES-AAAA-CAT-NNN`, donde `AAAA` es el año del hecho principal (o del hito normativo/votación que da origen a la ficha). Los ID nunca se reutilizan; si una ficha se retira, permanece con `estado_ficha: retirada` y el motivo documentado.

| Código | Categoría | Criterio mínimo de entrada |
| --- | --- | --- |
| `COR` | Corrupción judicializada | Causa penal con auto de apertura de juicio oral, auto de procesamiento o sentencia (firme o no firme). La ficha se ubica en el año de los hechos y su estado se actualiza en `historial`. |
| `FIN` | Financiación de partidos | Informe de fiscalización o sanción del Tribunal de Cuentas u órgano equivalente, o resolución judicial. |
| `PRM` | Promesa frente a BOE | Cita literal fechada (programa electoral, Diario de Sesiones o documento oficial) **y** norma o acto contrario publicado en el BOE o diario oficial. Formato Dijo / Firmó. |
| `VOT` | Cuando todos votan juntos | Votación nominal o resultado de votación en Diario de Sesiones sobre arquitectura del sistema, reglas electorales, órganos de control o autoprotección institucional. |
| `GRA` | Gracia e impunidad | Indulto (BOE), amnistía (BOE), prescripción o archivo por vencimiento de plazos procesales (auto). |
| `PGI` | Puertas giratorias | Nombramiento documentado (BORME, BOE, CNMV o memoria oficial) en un sector que el cargo público reguló o supervisó. |
| `SOC` | Socialización de pérdidas | Rescate, saneamiento, indemnización o asunción de deuda privada con coste público cuantificado por un organismo oficial (Banco de España, IGAE, TCu, Comisión Europea). |
| `CTL` | Colonización de órganos de control | Norma o nombramiento publicado que altera el sistema de elección, independencia o composición de un órgano de control (CGPJ, TC, TCu, Fiscalía, CNMC, RTVE, BdE, CIS). |
| `DEC` | Gobierno por decreto-ley | Real decreto-ley publicado en el BOE y su acuerdo de convalidación o derogación en el Congreso. |
| `LMD` | Leyes a medida | Reforma normativa con impacto directo documentado sobre causas judiciales abiertas o procedimientos concretos identificados. |
| `LEN` | Justicia lenta como impunidad | Procedimiento con plazo documentado entre la fecha de los hechos (o incoación) y la sentencia firme o prescripción, acreditado por ambos documentos. |
| `CRI` | Fallos de Estado en crisis | Actuación u omisión institucional durante una crisis acreditada mediante informes oficiales, comisiones documentadas o sentencias. |
| `SOB` | Soberanía y cesiones | Cesión de competencias o condiciones pactadas en tratado o acuerdo publicado en el BOE bajo criterio explícito y falsable. |
| `DET` | Deterioro acumulado | Dato anual de una serie oficial (INE, Banco de España, Eurostat, OCDE) que mide evolución estructural (empleo, deuda, vivienda, justicia). |

**Exclusiones expresas:** no entra una ley por ser únicamente polémica; no entran opiniones de columnistas ni valoraciones partidistas; no entran hechos sin fecha o sin fuente primaria; no entran rumores coetáneos no acreditados posteriormente; no entran citas célebres cuya literalidad no conste en fuente fiable.

---

## 4. Escala cerrada de estado procesal

El estado procesal **nunca** lo decide libremente un modelo de lenguaje. La validación automática exige que cada valor del campo `estado_procesal.actual` esté respaldado por el documento correspondiente en `fuentes`:

| Estado (`actual`) | Documento obligatorio | Etiqueta visible en la web |
| --- | --- | --- |
| `denunciado` | Auto de admisión (`auto`) | Investigación abierta |
| `investigado` | Auto de imputación (`auto`) | Investigado (presunción de inocencia) |
| `acusado` | Auto de apertura de juicio oral o procesamiento (`auto`) | Acusado |
| `condenado_no_firme` | Sentencia recurrible (`sentencia`) | Condenado en primera instancia |
| `condenado_firme` | Sentencia firme (`sentencia`) | Condenado |
| `absuelto` | Sentencia absolutoria (`sentencia`) | Absuelto |
| `archivado` | Auto de sobreseimiento (`auto`) | Archivado |
| `extinguido` | Auto de extinción (`auto`) + `motivo_extincion` | Sin juicio: `<motivo>` |
| `indultado` | Real Decreto de indulto en BOE (`boe`) | Condenado e indultado |
| `amnistiado` | Norma o resolución de amnistía (`boe`) | Condenado y amnistiado |
| `sancion_administrativa` | Resolución del TCu u órgano competente (`tcu` / `oficial`) | Sancionado (no penal) |
| `no_judicial` | Documento primario no penal | Hecho documentado sin causa judicial |

**Regla de visibilidad de absoluciones y archivos:** cuando una causa concluye con `absuelto`, `archivado` o `extinguido`, el estado cambia de inmediato y la **primera oración del resumen** recoge la resolución favorable.

---

## 5. Estilo, cifras y contexto monetario

- **Cero adjetivos valorativos** en títulos y resúmenes. La lista negra reside en `scripts/estilo/adjetivos.txt` y se comprueba en CI.
- **Resumen ≤ 60 palabras:** sujeto, verbo tomado del documento («condenó», «archivó», «aprobó», «convalidó»), objeto, fecha y cifra.
- **Trazabilidad cruzada:** toda cifra y entidad nombrada en el resumen debe estar respaldada por un `fragmento` en `fuentes`.
- **Cifras monetarias:**
  - Siempre con fuente, moneda y año (`euros corrientes de AAAA` o `pesetas corrientes de AAAA`).
  - Antes del 1 de enero de 2002: importe original en pesetas (`ESP`) y conversión oficial irrevocable a **166,386 pesetas por euro** (`valor_eur_conversion`).
  - La deflación con IPC del INE solo aparece en campo separado (`valor_eur_reales_AAAA`), nunca sustituyendo el importe histórico original.
- **Descargo obligatorio:** toda ficha incluye la postura del afectado, recurso o resolución favorable en `descargo`; si no existe, consta `descargo: null` justificado en el PR.

---

## 6. Garantías jurídicas, privacidad y rectificación

- **Particulares (`cargo_publico: false`):** en aplicación de la doctrina de la STC 58/2018 sobre derecho al olvido e interés público, cualquier persona que no ostentaba cargo público queda excluida del buscador interno (`data-pagefind-ignore`), carece de página de persona y obliga a emitir `<meta name="robots" content="noindex, nofollow">` en las páginas que la mencionen destacadamente.
- **Páginas de persona:** existen únicamente para personas con `cargo_publico: true`, y solo agrupan hechos ligados a su cargo público.
- **Imágenes y licencias:** prioridad estricta: facsímil oficial (art. 13 TRLPI) > Pool Moncloa > Wikimedia Commons en dominio público / CC0 > Wikimedia Commons CC BY / CC BY-SA con atribución. Quedan prohibidas fotos de agencia, prensa, licencias NC/ND y el recurso al art. 128 TRLPI.
- **Derecho de réplica y fe de erratas:** cada ficha enlaza al procedimiento de réplica/rectificación y todo cambio queda registrado en el historial de Git y publicado en `/erratas`.

---

## 7. Objeciones frecuentes y respuestas

### «En un año concreto casi todas las fichas son de un mismo partido»
**Respuesta (efecto de exposición):** quien ostenta el Gobierno central —y en particular una mayoría absoluta— dicta los decretos-ley, concede los indultos, propone los nombramientos de órganos estatales y ejecuta los presupuestos. Que ese año concentre actos del partido gobernante refleja la distribución del poder ejecutivo, no un cambio de criterio. Cada anuario declara explícitamente el efecto de exposición e investiga con el mismo esfuerzo gobiernos autonómicos, municipios y oposición. **Nunca** se relajan criterios ni se fuerzan casos para fabricar un equilibrio artificial: los huecos se declaran en el informe de cobertura.

### «¿Por qué no borráis una ficha cuando una causa se archiva o hay absolución?»
**Respuesta:** el archivo no presume culpabilidad; documenta el funcionamiento institucional, incluida la actuación judicial y los procedimientos que terminan en sobreseimiento o absolución. Borrar la ficha ocultaría tanto la corrección del proceso como la existencia de causas largas sin condena. En su lugar, el estado procesal pasa a `absuelto` o `archivado` y la resolución favorable figura en la primera frase del resumen. Si una persona afectada no era cargo público, se aplica `cargo_publico: false` y `noindex`.

### «¿Por qué no usáis colores de partido en las gráficas ni en las etiquetas?»
**Respuesta:** los colores partidistas inducen lectura tribal y sesgo visual. En La Invariante el partido es texto y filtro analítico. El único color de acento de la interfaz (rojo sello) se reserva para el estado procesal y los cambios de estado.

### «¿Qué garantiza que los agentes de IA no inventen datos o sesguen el archivo?»
**Respuesta:** cuatro barreras acumulativas: (1) los recolectores son scripts deterministas sin LLM que calculan `sha256`; (2) el verificador emplea obligatoriamente un modelo distinto del extractor con instrucción expresa de refutar la ficha; (3) la validación automática en CI exige documento primario, correspondencia estricta estado procesal ↔ tipo de documento, cobertura de cifras/entidades y cero adjetivos; y (4) ningún agente publica: todo entra por pull request y exige lectura humana frente al documento original antes de fusionarse.
