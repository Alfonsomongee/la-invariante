import path from 'node:path';
import {
  ESTADOS_PROCESALES,
  FUENTES_PRIMARIAS,
  LICENCIAS_IMAGEN,
  PESETAS_POR_EURO,
  contarPalabras,
  normalizarTexto,
  type Anuario,
  type Cifra,
  type EstadoFicha,
  type Ficha,
  type Fuente,
  type Imagen,
  type Promesa,
  type Protagonista,
  type ValidationIssue,
  type Votacion,
} from './constants.js';

const MAX_PALABRAS_RESUMEN = 60;
const MAX_PALABRAS_CONTEXTO_ANUARIO = 150;
const MAX_PALABRAS_FRAGMENTO_PRENSA = 30;
const MAX_CHARS_FRAGMENTO_PRENSA = 220;

const PALABRAS_ABSOLUCION_ARCHIVO = [
  'absuelt',
  'absolvi',
  'absolucion',
  'archiv',
  'sobrese',
  'extingui',
  'prescrib',
  'prescrip',
  'falleci',
  'sin juicio',
];

const STOPWORDS_ENTIDADES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'en', 'de', 'del',
  'por', 'para', 'con', 'sin', 'sobre', 'tras', 'entre', 'ante', 'bajo',
  'contra', 'segun', 'durante', 'mediante', 'desde', 'hasta', 'como',
  'espana', 'gobierno', 'estado', 'ley', 'real', 'decreto', 'organica',
  'articulo', 'tribunal', 'juzgado', 'audiencia', 'congreso', 'senado',
  'cortes', 'ministerio', 'consejo', 'boletin', 'oficial', 'enero',
  'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre', 'lunes', 'martes',
  'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'pesetas',
  'euros', 'millones', 'mil', 'ano', 'anos', 'dia', 'dias',
]);

export function validateIdAndPath(
  filePath: string,
  data: { id: string; anuario: number; categoria: string },
  enforceDirectoryMatch = true,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const baseName = path.basename(filePath, path.extname(filePath));
  const parentDir = path.basename(path.dirname(filePath));

  const match = data.id.match(/^ES-(\d{4})-([A-Z]{3})-(\d{3})$/);
  if (!match) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'id-formato',
      message: `ID inválido "${data.id}". Debe seguir el formato ES-AAAA-CAT-NNN.`,
    });
    return issues;
  }

  const [, idYearStr, idCat] = match;
  const idYear = Number(idYearStr);

  if (idYear !== data.anuario) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'id-anuario',
      message: `El año del ID (${idYear}) no coincide con el campo anuario (${data.anuario}).`,
    });
  }

  if (idCat !== data.categoria) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'id-categoria',
      message: `La categoría del ID (${idCat}) no coincide con el campo categoria (${data.categoria}).`,
    });
  }

  if (enforceDirectoryMatch) {
    if (baseName !== data.id) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'archivo-id',
        message: `El nombre del archivo (${baseName}.yaml) debe coincidir exactamente con el id (${data.id}).`,
      });
    }
    if (/^\d{4}$/.test(parentDir) && Number(parentDir) !== data.anuario) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'directorio-anuario',
        message: `El directorio (${parentDir}/) no coincide con el campo anuario (${data.anuario}).`,
      });
    }
  }

  return issues;
}

export function validateFuentes(
  filePath: string,
  fuentes: Fuente[],
  estadoFicha: EstadoFicha | 'borrador' | 'revision' | 'publicado',
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const primarias = fuentes.filter((f) => FUENTES_PRIMARIAS.has(f.tipo));
  if (primarias.length === 0) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'regla-1-fuente-primaria',
      message:
        'Sin documento primario no hay ficha. Debe incluir al menos una fuente de tipo boe, sentencia, auto, diario_sesiones, tcu, oficial o programa.',
    });
  }

  const requiereShaReal = estadoFicha === 'revision' || estadoFicha === 'publicada' || estadoFicha === 'publicado';
  for (const [idx, fuente] of fuentes.entries()) {
    if (requiereShaReal && FUENTES_PRIMARIAS.has(fuente.tipo) && fuente.sha256 === 'pendiente') {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'fuente-sha256',
        message: `fuentes[${idx}] (${fuente.tipo}) tiene sha256="pendiente", prohibido en estado "${estadoFicha}". Sube el documento a R2 o calcula su SHA-256.`,
      });
    }

    // Regla 9: Nada de citas largas de prensa
    if (fuente.tipo === 'prensa') {
      const palabras = contarPalabras(fuente.fragmento);
      if (palabras > MAX_PALABRAS_FRAGMENTO_PRENSA || fuente.fragmento.length > MAX_CHARS_FRAGMENTO_PRENSA) {
        issues.push({
          file: filePath,
          severity: 'error',
          rule: 'regla-9-cita-prensa',
          message: `fuentes[${idx}] es de tipo "prensa" y su fragmento tiene ${palabras} palabras (${fuente.fragmento.length} caracteres). Regla 9: de la prensa solo dato breve (≤${MAX_PALABRAS_FRAGMENTO_PRENSA} palabras) y enlace; citas largas solo de documentos oficiales (art. 13 TRLPI).`,
        });
      }
    }
  }

  return issues;
}

export function validateEstadoProcesal(filePath: string, ficha: Ficha): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { estado_procesal: ep, fuentes, resumen } = ficha;
  const regla = ESTADOS_PROCESALES[ep.actual];

  if (!regla) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'estado-procesal-invalido',
      message: `Estado procesal desconocido: "${ep.actual}".`,
    });
    return issues;
  }

  // Verificar que existe un documento primario cuyo tipo acredita el estado_procesal.actual
  const fuentesCompatibles = fuentes.filter((f) => {
    if (!regla.tiposFuenteRequeridos.includes(f.tipo)) return false;
    if (f.subtipo && regla.subtiposProhibidos?.includes(f.subtipo)) return false;
    if (f.subtipo && regla.subtiposAceptados && !regla.subtiposAceptados.includes(f.subtipo)) {
      // Si la fuente declara subtipo explícito incompatible con el estado actual, no acredita este estado
      return false;
    }
    return true;
  });

  if (fuentesCompatibles.length === 0) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'regla-3-estado-documento',
      message: `El estado procesal "${ep.actual}" exige al menos una fuente de tipo [${regla.tiposFuenteRequeridos.join(', ')}]${regla.subtiposAceptados ? ` (subtipo compatible: ${regla.subtiposAceptados.join(', ')})` : ''}. El estado procesal no lo decide un LLM sin documento acreditativo.`,
    });
  }

  if (ep.actual === 'extinguido' && (!ep.motivo_extincion || ep.motivo_extincion.trim().length < 3)) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'estado-extinguido-motivo',
      message: 'Cuando estado_procesal.actual es "extinguido", debe especificarse motivo_extincion (salud, fallecimiento, prescripción).',
    });
  }

  // Verificar orden cronológico y coherencia del historial
  if (ep.actual !== 'no_judicial' && ep.historial.length === 0) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'estado-historial-vacio',
      message: `El estado procesal "${ep.actual}" requiere al menos un hito fechado en estado_procesal.historial.`,
    });
  }

  for (let i = 1; i < ep.historial.length; i++) {
    if (ep.historial[i].fecha < ep.historial[i - 1].fecha) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'estado-historial-orden',
        message: `estado_procesal.historial no está ordenado cronológicamente (${ep.historial[i - 1].fecha} > ${ep.historial[i].fecha}).`,
      });
    }
  }

  if (ep.historial.length > 0) {
    const ultimo = ep.historial[ep.historial.length - 1];
    if (ultimo.estado !== ep.actual) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'estado-historial-ultimo',
        message: `El último estado de estado_procesal.historial ("${ultimo.estado}") debe coincidir con estado_procesal.actual ("${ep.actual}").`,
      });
    }
  }

  // Regla 4: Archivos y absoluciones con la misma visibilidad — en la primera línea del resumen
  if (regla.exigePrimeraLinea) {
    const primeraOracion = normalizarTexto(resumen.split(/[.!?\n]/)[0] ?? '');
    const mencionaResolucion = PALABRAS_ABSOLUCION_ARCHIVO.some((raiz) =>
      primeraOracion.includes(raiz),
    );
    if (!mencionaResolucion) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'regla-4-primera-linea',
        message: `Estado "${ep.actual}": según la Regla 4, la primera oración del resumen debe declarar explícitamente la absolución, el archivo/sobreseimiento o la extinción.`,
      });
    }
  }

  return issues;
}

export function validateCifras(
  filePath: string,
  cifras: Cifra[] | undefined,
  estadoFicha: EstadoFicha,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!cifras || cifras.length === 0) return issues;

  for (const [idx, cifra] of cifras.entries()) {
    if (cifra.anio_moneda < 2002) {
      if (cifra.moneda !== 'ESP') {
        issues.push({
          file: filePath,
          severity: 'error',
          rule: 'regla-8-pesetas-pre-2002',
          message: `cifras[${idx}] ("${cifra.concepto}") corresponde a ${cifra.anio_moneda} (< 2002): debe registrarse en pesetas (moneda: ESP) con conversión a 166,386 ptas/€.`,
        });
      } else {
        const esperada = Number((cifra.valor / PESETAS_POR_EURO).toFixed(2));
        if (cifra.valor_eur_conversion === undefined) {
          issues.push({
            file: filePath,
            severity: estadoFicha === 'borrador' ? 'warning' : 'error',
            rule: 'regla-8-conversion-eur',
            message: `cifras[${idx}] en ESP carece de valor_eur_conversion (esperado: ${esperada} € a 166,386 ptas/€).`,
          });
        } else if (Math.abs(cifra.valor_eur_conversion - esperada) > 0.05) {
          issues.push({
            file: filePath,
            severity: 'error',
            rule: 'regla-8-conversion-exacta',
            message: `cifras[${idx}] valor_eur_conversion (${cifra.valor_eur_conversion}) no coincide con valor / 166,386 (${esperada}).`,
          });
        }
      }
    } else if (cifra.moneda !== 'EUR') {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'regla-8-euros-post-2002',
        message: `cifras[${idx}] corresponde a ${cifra.anio_moneda} (>= 2002): la moneda debe ser EUR.`,
      });
    }

    const camposReales = Object.keys(cifra).filter((k) => /^valor_eur_reales_\d{4}$/.test(k));
    if (camposReales.length > 0 && !cifra.fuente_ipc) {
      issues.push({
        file: filePath,
        severity: 'warning',
        rule: 'regla-8-fuente-ipc',
        message: `cifras[${idx}] incluye deflación (${camposReales.join(', ')}) sin especificar fuente_ipc (IPC del INE).`,
      });
    }
  }

  return issues;
}

function normalizarNumero(raw: string): string[] {
  const variantes = new Set<string>();
  const limpio = raw.trim();
  variantes.add(limpio);
  // 800.000 -> 800000 y 800,000
  const sinPuntos = limpio.replace(/\./g, '');
  variantes.add(sinPuntos);
  variantes.add(sinPuntos.replace(',', '.'));
  const soloDigitos = limpio.replace(/[^\d]/g, '');
  if (soloDigitos.length >= 2) variantes.add(soloDigitos);
  return [...variantes];
}

export function validateCoberturaResumen(
  filePath: string,
  resumen: string,
  fuentes: Fuente[],
  cifras?: Cifra[],
  protagonistas?: Protagonista[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Longitud máxima de 60 palabras (Regla 7)
  const numPalabras = contarPalabras(resumen);
  if (numPalabras > MAX_PALABRAS_RESUMEN) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'regla-7-longitud-resumen',
      message: `El resumen tiene ${numPalabras} palabras (máximo permitido: ${MAX_PALABRAS_RESUMEN}).`,
    });
  }

  // Corpus combinado de fragmentos y títulos de documentos primarios + cifras
  const primarias = fuentes.filter((f) => FUENTES_PRIMARIAS.has(f.tipo));
  const corpusBase = [
    ...primarias.map((f) => `${f.titulo_documento ?? ''} ${f.fragmento}`),
    ...(cifras ?? []).map((c) => `${c.concepto} ${c.valor} ${c.anio_moneda} ${c.valor_eur_conversion ?? ''}`),
  ].join(' ');
  const corpusNorm = normalizarTexto(corpusBase);
  const corpusCompacto = corpusNorm.replace(/[.,]/g, '');

  // 1. Cobertura de cifras, números de ley y años en el resumen
  const tokensNumericos = resumen.match(/\b\d+(?:[./,-]\d+)*\b/g) ?? [];
  const numerosFaltantes: string[] = [];
  for (const num of new Set(tokensNumericos)) {
    // Números ordinales triviales de un dígito como "2" o "3" pueden aparecer escritos con letra ("dos", "tres")
    const variantes = normalizarNumero(num);
    const encontrado = variantes.some(
      (v) => corpusNorm.includes(v.toLowerCase()) || corpusCompacto.includes(v.replace(/[.,]/g, '').toLowerCase()),
    );
    if (!encontrado && num.length >= 2) {
      numerosFaltantes.push(num);
    }
  }

  if (numerosFaltantes.length > 0 && primarias.length > 0) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'cobertura-cifras',
      message: `Las siguientes cifras/referencias del resumen no aparecen en ningún fragmento de fuentes primarias: ${numerosFaltantes.join(', ')}.`,
    });
  }

  // 2. Cobertura de siglas (PSOE, CGPJ, LOREG, BOE...) y apellidos de protagonistas mencionados en el resumen
  const siglas = resumen.match(/\b[A-ZÁÉÍÓÚÑ]{2,}(?:-[A-ZÁÉÍÓÚÑ]{2,})?\b/g) ?? [];
  const entidadesFaltantes = new Set<string>();

  for (const sigla of new Set(siglas)) {
    const norm = normalizarTexto(sigla);
    if (STOPWORDS_ENTIDADES.has(norm)) continue;
    // Aceptar coincidencia exacta o mención desarrollada conocida
    const alias: Record<string, string[]> = {
      boe: ['boletin oficial del estado', 'boe'],
      cgpj: ['consejo general del poder judicial', 'cgpj'],
      tc: ['tribunal constitucional', 'tc'],
      tcu: ['tribunal de cuentas', 'tcu'],
      ts: ['tribunal supremo', 'ts'],
      an: ['audiencia nacional', 'an'],
      loreg: ['regimen electoral general', '5/1985', 'loreg'],
      lopj: ['poder judicial', '6/1985', 'lopj'],
      psoe: ['partido socialista obrero espanol', 'grupo socialista', 'psoe'],
      ap: ['alianza popular', 'grupo popular', 'ap'],
      pp: ['partido popular', 'grupo popular', 'pp'],
      ciu: ['convergencia i unio', 'minoria catalana', 'ciu'],
      pnv: ['partido nacionalista vasco', 'grupo vasco', 'pnv'],
      ucd: ['union de centro democratico', 'ucd'],
      pce: ['partido comunista', 'pce'],
      iu: ['izquierda unida', 'iu'],
      cee: ['comunidades europeas', 'comunidad economica europea', 'cee'],
      otan: ['tratado del atlantico norte', 'otan'],
      ine: ['instituto nacional de estadistica', 'ine'],
      epa: ['encuesta de poblacion activa', 'epa'],
    };
    const patrones = alias[norm] ?? [norm];
    if (!patrones.some((p) => corpusNorm.includes(p))) {
      entidadesFaltantes.add(sigla);
    }
  }

  // Comprobar apellidos de protagonistas que aparezcan en el resumen
  if (protagonistas && protagonistas.length > 0) {
    const resumenNorm = normalizarTexto(resumen);
    for (const prot of protagonistas) {
      const partes = normalizarTexto(prot.nombre)
        .split(/\s+/)
        .filter((p) => p.length >= 4 && !STOPWORDS_ENTIDADES.has(p));
      const apellido = partes[partes.length - 1];
      if (apellido && resumenNorm.includes(apellido) && !corpusNorm.includes(apellido)) {
        entidadesFaltantes.add(prot.nombre);
      }
    }
  }

  if (entidadesFaltantes.size > 0 && primarias.length > 0) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'cobertura-entidades',
      message: `Entidades del resumen sin respaldo en los fragmentos de fuentes primarias: ${[...entidadesFaltantes].join(', ')}.`,
    });
  }

  return issues;
}

export function validateImagenYPrivacidad(
  filePath: string,
  imagen: Imagen | null,
  protagonistas: Protagonista[] | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (imagen !== null) {
    if (!LICENCIAS_IMAGEN.includes(imagen.licencia)) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'regla-8-licencia-imagen',
        message: `Licencia de imagen no permitida: "${imagen.licencia}". Solo se admiten: ${LICENCIAS_IMAGEN.join(', ')}.`,
      });
    }
    if (!imagen.autor || imagen.autor.trim().length < 2) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'regla-8-autor-imagen',
        message: 'Toda imagen debe indicar autor o institución de procedencia.',
      });
    }
  }

  if (protagonistas) {
    for (const [idx, prot] of protagonistas.entries()) {
      if (typeof prot.cargo_publico !== 'boolean') {
        issues.push({
          file: filePath,
          severity: 'error',
          rule: 'regla-8-cargo-publico',
          message: `protagonistas[${idx}] (${prot.nombre}) debe declarar cargo_publico: true|false (STC 58/2018).`,
        });
      }
    }
  }

  return issues;
}

export function validateDescargo(
  filePath: string,
  descargo: string | null | undefined,
  estadoFicha: EstadoFicha,
  justificacionNull?: string | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (descargo === undefined) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'regla-5-descargo-obligatorio',
      message: 'El campo descargo es obligatorio (texto de descargo o null explícito).',
    });
  } else if (descargo === null && estadoFicha === 'publicada' && !justificacionNull) {
    issues.push({
      file: filePath,
      severity: 'warning',
      rule: 'regla-5-descargo-null-justificacion',
      message: 'descargo es null en ficha publicada; conviene documentar descargo_justificacion_null o justificarlo en el PR.',
    });
  }
  return issues;
}

export function validateFichaCrossRules(
  filePath: string,
  ficha: Ficha,
  enforceDirectoryMatch = true,
): ValidationIssue[] {
  return [
    ...validateIdAndPath(filePath, ficha, enforceDirectoryMatch),
    ...validateFuentes(filePath, ficha.fuentes, ficha.estado_ficha),
    ...validateEstadoProcesal(filePath, ficha),
    ...validateCifras(filePath, ficha.cifras, ficha.estado_ficha),
    ...validateCoberturaResumen(filePath, ficha.resumen, ficha.fuentes, ficha.cifras, ficha.protagonistas),
    ...validateImagenYPrivacidad(filePath, ficha.imagen, ficha.protagonistas),
    ...validateDescargo(filePath, ficha.descargo, ficha.estado_ficha, ficha.descargo_justificacion_null),
  ];
}

export function validatePromesaCrossRules(
  filePath: string,
  promesa: Promesa,
  enforceDirectoryMatch = true,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateIdAndPath(filePath, promesa, enforceDirectoryMatch),
    ...validateFuentes(filePath, promesa.fuentes, promesa.estado_ficha),
    ...validateCifras(filePath, promesa.cifras, promesa.estado_ficha),
    ...validateCoberturaResumen(filePath, promesa.resumen, promesa.fuentes, promesa.cifras, promesa.protagonistas),
    ...validateImagenYPrivacidad(filePath, promesa.imagen, promesa.protagonistas),
    ...validateDescargo(filePath, promesa.descargo, promesa.estado_ficha, promesa.descargo_justificacion_null),
  ];

  const urlsFuentes = new Set(promesa.fuentes.map((f) => f.url));
  if (!urlsFuentes.has(promesa.dijo.fuente_url)) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'promesa-dijo-fuente',
      message: `dijo.fuente_url (${promesa.dijo.fuente_url}) debe figurar en el listado de fuentes.`,
    });
  }
  if (!urlsFuentes.has(promesa.firmo.fuente_url)) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'promesa-firmo-fuente',
      message: `firmo.fuente_url (${promesa.firmo.fuente_url}) debe figurar en el listado de fuentes.`,
    });
  }

  const fuenteFirmo = promesa.fuentes.find((f) => f.url === promesa.firmo.fuente_url);
  if (fuenteFirmo && !FUENTES_PRIMARIAS.has(fuenteFirmo.tipo)) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'promesa-firmo-primaria',
      message: `La fuente de firmo debe ser primaria (boe, diario_sesiones, oficial...), no "${fuenteFirmo.tipo}".`,
    });
  }

  if (promesa.dijo.fecha > promesa.firmo.fecha) {
    issues.push({
      file: filePath,
      severity: 'warning',
      rule: 'promesa-cronologia',
      message: `La fecha de dijo (${promesa.dijo.fecha}) es posterior a firmo (${promesa.firmo.fecha}). Verifica la cronología.`,
    });
  }

  return issues;
}

export function validateVotacionCrossRules(
  filePath: string,
  votacion: Votacion,
  enforceDirectoryMatch = true,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateIdAndPath(filePath, votacion, enforceDirectoryMatch),
    ...validateFuentes(filePath, votacion.fuentes, votacion.estado_ficha),
    ...validateCifras(filePath, votacion.cifras, votacion.estado_ficha),
    ...validateCoberturaResumen(filePath, votacion.resumen, votacion.fuentes, votacion.cifras, votacion.protagonistas),
    ...validateImagenYPrivacidad(filePath, votacion.imagen, votacion.protagonistas),
    ...validateDescargo(filePath, votacion.descargo, votacion.estado_ficha, votacion.descargo_justificacion_null),
  ];

  const sumaResultado =
    votacion.resultado.a_favor + votacion.resultado.en_contra + votacion.resultado.abstenciones;
  if (
    votacion.resultado.total_emitidos !== undefined &&
    votacion.resultado.total_emitidos !== sumaResultado
  ) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'votacion-suma-emitidos',
      message: `resultado.total_emitidos (${votacion.resultado.total_emitidos}) no coincide con a_favor + en_contra + abstenciones (${sumaResultado}).`,
    });
  }

  const tieneActa = votacion.fuentes.some((f) =>
    f.tipo === 'diario_sesiones' || f.tipo === 'oficial' || f.tipo === 'boe',
  );
  if (!tieneActa) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'votacion-acta-primaria',
      message: 'Toda votación debe acreditar al menos una fuente de Diario de Sesiones, BOE o registro parlamentario oficial.',
    });
  }

  return issues;
}

export function validateAnuarioCrossRules(
  filePath: string,
  anuario: Anuario,
  enforceDirectoryMatch = true,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (enforceDirectoryMatch) {
    const baseName = path.basename(filePath, path.extname(filePath));
    if (baseName !== String(anuario.anio)) {
      issues.push({
        file: filePath,
        severity: 'error',
        rule: 'anuario-nombre-archivo',
        message: `El nombre del archivo (${baseName}.yaml) debe coincidir con el campo anio (${anuario.anio}).`,
      });
    }
  }

  const palabras = contarPalabras(anuario.contexto_resumen);
  if (palabras > MAX_PALABRAS_CONTEXTO_ANUARIO) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'anuario-longitud-contexto',
      message: `contexto_resumen tiene ${palabras} palabras (máximo permitido: ${MAX_PALABRAS_CONTEXTO_ANUARIO}).`,
    });
  }

  const totalEscanos = anuario.composicion_congreso.reduce((acc, g) => acc + g.escanos, 0);
  if (totalEscanos > 350) {
    issues.push({
      file: filePath,
      severity: 'error',
      rule: 'anuario-escanos-congreso',
      message: `La suma de escaños en composicion_congreso (${totalEscanos}) supera el máximo constitucional de 350.`,
    });
  }

  issues.push(...validateFuentes(filePath, anuario.fuentes, anuario.estado_anuario));
  return issues;
}
