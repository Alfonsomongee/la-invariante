export const PESETAS_POR_EURO = 166.386;

export const CATEGORIAS = {
  COR: { codigo: 'COR', nombre: 'Corrupción judicializada' },
  FIN: { codigo: 'FIN', nombre: 'Financiación de partidos' },
  PRM: { codigo: 'PRM', nombre: 'Promesa frente a BOE' },
  VOT: { codigo: 'VOT', nombre: 'Cuando todos votan juntos' },
  GRA: { codigo: 'GRA', nombre: 'Gracia e impunidad' },
  PGI: { codigo: 'PGI', nombre: 'Puertas giratorias' },
  SOC: { codigo: 'SOC', nombre: 'Socialización de pérdidas' },
  CTL: { codigo: 'CTL', nombre: 'Colonización de órganos de control' },
  DEC: { codigo: 'DEC', nombre: 'Gobierno por decreto-ley' },
  LMD: { codigo: 'LMD', nombre: 'Leyes a medida' },
  LEN: { codigo: 'LEN', nombre: 'Justicia lenta como impunidad' },
  CRI: { codigo: 'CRI', nombre: 'Fallos de Estado en crisis' },
  SOB: { codigo: 'SOB', nombre: 'Soberanía y cesiones' },
  DET: { codigo: 'DET', nombre: 'Deterioro acumulado' },
} as const;

export type CategoriaCodigo = keyof typeof CATEGORIAS;

export type TipoFuente =
  | 'boe'
  | 'sentencia'
  | 'auto'
  | 'diario_sesiones'
  | 'tcu'
  | 'oficial'
  | 'programa'
  | 'prensa';

export type SubtipoFuente =
  | 'auto_admision'
  | 'auto_imputacion'
  | 'auto_procesamiento'
  | 'auto_apertura_juicio_oral'
  | 'sentencia_recurrible'
  | 'sentencia_firme'
  | 'sentencia_absolutoria'
  | 'auto_sobreseimiento'
  | 'auto_extincion'
  | 'boe_indulto'
  | 'boe_amnistia'
  | 'resolucion_administrativa'
  | 'norma'
  | 'otro';

export const FUENTES_PRIMARIAS: ReadonlySet<TipoFuente> = new Set([
  'boe',
  'sentencia',
  'auto',
  'diario_sesiones',
  'tcu',
  'oficial',
  'programa',
]);

export const LICENCIAS_IMAGEN = [
  'art13_trlpi',
  'pool_moncloa',
  'pd',
  'cc0',
  'cc-by',
  'cc-by-sa',
] as const;

export type LicenciaImagen = (typeof LICENCIAS_IMAGEN)[number];

export type EstadoProcesalValor =
  | 'denunciado'
  | 'investigado'
  | 'acusado'
  | 'condenado_no_firme'
  | 'condenado_firme'
  | 'absuelto'
  | 'archivado'
  | 'extinguido'
  | 'indultado'
  | 'amnistiado'
  | 'sancion_administrativa'
  | 'no_judicial';

export interface ReglaEstadoProcesal {
  etiqueta: string;
  tiposFuenteRequeridos: TipoFuente[];
  subtiposAceptados?: SubtipoFuente[];
  subtiposProhibidos?: SubtipoFuente[];
  exigePrimeraLinea: boolean;
  esAbierto: boolean;
}

export const ESTADOS_PROCESALES: Record<EstadoProcesalValor, ReglaEstadoProcesal> = {
  denunciado: {
    etiqueta: 'Investigación abierta',
    tiposFuenteRequeridos: ['auto'],
    subtiposAceptados: ['auto_admision'],
    exigePrimeraLinea: false,
    esAbierto: true,
  },
  investigado: {
    etiqueta: 'Investigado (presunción de inocencia)',
    tiposFuenteRequeridos: ['auto'],
    subtiposAceptados: ['auto_imputacion'],
    exigePrimeraLinea: false,
    esAbierto: true,
  },
  acusado: {
    etiqueta: 'Acusado',
    tiposFuenteRequeridos: ['auto'],
    subtiposAceptados: ['auto_procesamiento', 'auto_apertura_juicio_oral'],
    exigePrimeraLinea: false,
    esAbierto: true,
  },
  condenado_no_firme: {
    etiqueta: 'Condenado en primera instancia',
    tiposFuenteRequeridos: ['sentencia'],
    subtiposAceptados: ['sentencia_recurrible'],
    subtiposProhibidos: ['sentencia_absolutoria'],
    exigePrimeraLinea: false,
    esAbierto: true,
  },
  condenado_firme: {
    etiqueta: 'Condenado',
    tiposFuenteRequeridos: ['sentencia'],
    subtiposAceptados: ['sentencia_firme'],
    subtiposProhibidos: ['sentencia_absolutoria'],
    exigePrimeraLinea: false,
    esAbierto: false,
  },
  absuelto: {
    etiqueta: 'Absuelto',
    tiposFuenteRequeridos: ['sentencia'],
    subtiposAceptados: ['sentencia_absolutoria'],
    exigePrimeraLinea: true,
    esAbierto: false,
  },
  archivado: {
    etiqueta: 'Archivado',
    tiposFuenteRequeridos: ['auto'],
    subtiposAceptados: ['auto_sobreseimiento'],
    exigePrimeraLinea: true,
    esAbierto: false,
  },
  extinguido: {
    etiqueta: 'Sin juicio',
    tiposFuenteRequeridos: ['auto'],
    subtiposAceptados: ['auto_extincion'],
    exigePrimeraLinea: true,
    esAbierto: false,
  },
  indultado: {
    etiqueta: 'Condenado e indultado',
    tiposFuenteRequeridos: ['boe'],
    subtiposAceptados: ['boe_indulto'],
    exigePrimeraLinea: false,
    esAbierto: false,
  },
  amnistiado: {
    etiqueta: 'Condenado y amnistiado',
    tiposFuenteRequeridos: ['boe'],
    subtiposAceptados: ['boe_amnistia'],
    exigePrimeraLinea: false,
    esAbierto: false,
  },
  sancion_administrativa: {
    etiqueta: 'Sancionado (no penal)',
    tiposFuenteRequeridos: ['tcu', 'oficial', 'boe'],
    subtiposAceptados: ['resolucion_administrativa'],
    exigePrimeraLinea: false,
    esAbierto: false,
  },
  no_judicial: {
    etiqueta: 'Hecho documentado sin causa judicial',
    tiposFuenteRequeridos: ['boe', 'diario_sesiones', 'tcu', 'oficial', 'programa', 'sentencia', 'auto'],
    exigePrimeraLinea: false,
    esAbierto: false,
  },
};

export interface Protagonista {
  nombre: string;
  cargo_en_el_momento: string;
  cargo_publico: boolean;
  wikidata?: string | null;
}

export interface HistorialProcesal {
  fecha: string;
  estado: EstadoProcesalValor;
  documento: string;
  nota?: string;
}

export interface EstadoProcesal {
  actual: EstadoProcesalValor;
  motivo_extincion?: string | null;
  historial: HistorialProcesal[];
}

export interface Cifra {
  concepto: string;
  valor: number;
  moneda: 'ESP' | 'EUR';
  anio_moneda: number;
  valor_eur_conversion?: number;
  fuente: string;
  fuente_ipc?: string;
  [key: `valor_eur_reales_${number}`]: number | undefined;
}

export interface Fuente {
  tipo: TipoFuente;
  subtipo?: SubtipoFuente;
  titulo_documento?: string;
  url: string;
  wayback_url?: string | null;
  sha256: string;
  capturado: string;
  pagina: number | string | null;
  fragmento: string;
}

export interface Imagen {
  tipo: 'facsimil' | 'foto';
  licencia: LicenciaImagen;
  autor: string;
  origen: string;
  archivo?: string;
  alt?: string;
}

export interface Version {
  fecha: string;
  cambio: string;
  motivo: string;
}

export interface Investigacion {
  confianza: 'alta' | 'media' | 'baja';
  documentos_localizados: string[];
  documentos_no_localizados: string[];
  intento_de_refutacion: string;
}

export type EstadoFicha = 'borrador' | 'revision' | 'publicada' | 'retirada';

export interface Ficha {
  id: string;
  anuario: number;
  categoria: CategoriaCodigo;
  contraprueba?: boolean;
  contraprueba_motivo?: string | null;
  partidos: string[];
  nivel: 'estatal' | 'autonomico' | 'local';
  ambito_territorial?: string;
  protagonistas: Protagonista[];
  estado_procesal: EstadoProcesal;
  titulo: string;
  resumen: string;
  descargo: string | null;
  descargo_justificacion_null?: string | null;
  cifras: Cifra[];
  fuentes: Fuente[];
  imagen: Imagen | null;
  estado_ficha: EstadoFicha;
  motivo_retirada?: string | null;
  versiones: Version[];
  etiquetas?: string[];
  investigacion?: Investigacion;
}

export interface Promesa {
  id: string;
  anuario: number;
  categoria: 'PRM';
  contraprueba?: boolean;
  contraprueba_motivo?: string | null;
  partidos: string[];
  nivel: 'estatal' | 'autonomico' | 'local';
  ambito_territorial?: string;
  protagonistas?: Protagonista[];
  titulo: string;
  resumen: string;
  dijo: {
    fecha: string;
    autor: string;
    cargo_en_el_momento: string;
    cargo_publico: boolean;
    wikidata?: string | null;
    partido: string;
    cita_literal: string;
    contexto: string;
    fuente_url: string;
  };
  firmo: {
    fecha: string;
    organismo: string;
    norma_o_acto: string;
    descripcion_factual: string;
    fuente_url: string;
  };
  descargo: string | null;
  descargo_justificacion_null?: string | null;
  cifras?: Cifra[];
  fuentes: Fuente[];
  imagen: Imagen | null;
  estado_ficha: EstadoFicha;
  motivo_retirada?: string | null;
  versiones: Version[];
  investigacion?: Investigacion;
}

export interface Votacion {
  id: string;
  anuario: number;
  categoria: 'VOT';
  contraprueba?: boolean;
  contraprueba_motivo?: string | null;
  partidos: string[];
  nivel: 'estatal' | 'autonomico' | 'local';
  ambito_territorial?: string;
  protagonistas?: Protagonista[];
  titulo: string;
  resumen: string;
  sesion: {
    fecha: string;
    legislatura: string;
    camara: 'congreso' | 'senado' | 'parlamento_autonomico';
    numero_sesion?: string | number | null;
    asunto: string;
    norma_resultante?: string | null;
  };
  resultado: {
    a_favor: number;
    en_contra: number;
    abstenciones: number;
    ausentes?: number;
    total_emitidos?: number;
  };
  grupos: Array<{
    grupo: string;
    partido: string;
    sentido: 'a_favor' | 'en_contra' | 'abstencion' | 'dividido' | 'ausente';
    a_favor?: number;
    en_contra?: number;
    abstenciones?: number;
  }>;
  descargo: string | null;
  descargo_justificacion_null?: string | null;
  cifras?: Cifra[];
  fuentes: Fuente[];
  imagen: Imagen | null;
  estado_ficha: EstadoFicha;
  motivo_retirada?: string | null;
  versiones: Version[];
  investigacion?: Investigacion;
}

export interface Anuario {
  anio: number;
  legislatura: string;
  moneda_curso?: 'ESP' | 'EUR';
  gobiernos: Array<{
    presidente: string;
    partido: string;
    coalicion?: string[];
    tipo_mayoria: string;
    desde: string;
    hasta?: string | null;
  }>;
  composicion_congreso: Array<{ partido: string; escanos: number }>;
  gobiernos_autonomicos: Array<{ comunidad: string; presidente: string; partido: string }>;
  contexto_resumen: string;
  nota_exposicion: string;
  hitos?: Array<{ fecha: string; descripcion: string; fuente_url: string }>;
  descartes?: Array<{ pista: string; motivo_descarte: string; requisito_entrada: string }>;
  cobertura?: {
    notas?: string;
    huecos?: string[];
    documentos_manuales?: string[];
  };
  fuentes: Fuente[];
  estado_anuario: 'borrador' | 'revision' | 'publicado';
  versiones: Version[];
}

export interface ValidationIssue {
  file: string;
  severity: 'error' | 'warning';
  rule: string;
  message: string;
}

export function etiquetaEstadoProcesal(estado: EstadoProcesal): string {
  if (estado.actual === 'extinguido' && estado.motivo_extincion) {
    return `Sin juicio: ${estado.motivo_extincion}`;
  }
  return ESTADOS_PROCESALES[estado.actual].etiqueta;
}

export function contarPalabras(texto: string): number {
  const limpio = texto.trim();
  if (!limpio) return 0;
  return limpio.split(/\s+/).length;
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
