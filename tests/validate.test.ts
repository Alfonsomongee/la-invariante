import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { validateRepository } from '../scripts/validate.js';
import {
  validateCifras,
  validateCoberturaResumen,
  validateEstadoProcesal,
  validateFuentes,
} from '../scripts/lib/rules.js';
import type { Ficha } from '../scripts/lib/constants.js';

const VALID_SHA = 'a'.repeat(64);

function makeValidFicha(overrides: Partial<Ficha> = {}): Ficha {
  return {
    id: 'ES-1985-CTL-001',
    anuario: 1985,
    categoria: 'CTL',
    partidos: ['PSOE'],
    nivel: 'estatal',
    protagonistas: [
      {
        nombre: 'Ejemplo Cargo Público',
        cargo_en_el_momento: 'Ministro de Justicia',
        cargo_publico: true,
        wikidata: 'Q12345',
      },
    ],
    estado_procesal: {
      actual: 'no_judicial',
      historial: [],
    },
    titulo: 'Ley Orgánica 6/1985 de reforma del sistema de elección del CGPJ',
    resumen:
      'Las Cortes aprobaron la Ley Orgánica 6/1985, publicada en el BOE el 2 de julio de 1985, que asignó al Congreso y al Senado la elección de los 20 vocales del CGPJ.',
    descargo:
      'El Gobierno sostuvo en el debate parlamentario que la elección parlamentaria reforzaba la legitimidad democrática del órgano.',
    cifras: [],
    fuentes: [
      {
        tipo: 'boe',
        subtipo: 'norma',
        titulo_documento: 'Ley Orgánica 6/1985, de 1 de julio, del Poder Judicial (BOE 2 de julio de 1985)',
        url: 'https://www.boe.es/eli/es/lo/1985/07/01/6',
        wayback_url: 'https://web.archive.org/web/20260101000000/https://www.boe.es/eli/es/lo/1985/07/01/6',
        sha256: VALID_SHA,
        capturado: '2026-11-25',
        pagina: 1,
        fragmento:
          'Las Cortes Generales aprueban la Ley Orgánica 6/1985. El Congreso de los Diputados y el Senado elegirán a los 20 vocales del Consejo General del Poder Judicial.',
      },
    ],
    imagen: {
      tipo: 'facsimil',
      licencia: 'art13_trlpi',
      autor: 'Agencia Estatal Boletín Oficial del Estado',
      origen: 'https://www.boe.es/eli/es/lo/1985/07/01/6',
    },
    estado_ficha: 'publicada',
    versiones: [
      {
        fecha: '2026-11-25',
        cambio: 'Creación de ficha de prueba',
        motivo: 'Test unitario',
      },
    ],
    ...overrides,
  };
}

describe('Validador de esquemas y reglas cruzadas (scripts/validate.ts)', () => {
  it('acepta una ficha válida completa en estructura de directorios', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'invariante-test-'));
    try {
      const fichaDir = path.join(tmp, 'fichas', '1985');
      fs.mkdirSync(fichaDir, { recursive: true });
      fs.writeFileSync(path.join(fichaDir, 'ES-1985-CTL-001.yaml'), yaml.dump(makeValidFicha()));

      const res = validateRepository({ contentDir: tmp });
      assert.equal(res.errors.length, 0, `Errores inesperados: ${JSON.stringify(res.errors)}`);
      assert.equal(res.filesChecked, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rechaza ficha sin documento primario (solo prensa — Regla 1)', () => {
    const issues = validateFuentes(
      'ES-1985-COR-001.yaml',
      [
        {
          tipo: 'prensa',
          url: 'https://ejemplo.es/noticia',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: null,
          fragmento: 'Noticia de prensa sobre un presunto caso en 1985.',
        },
      ],
      'publicada',
    );
    assert.ok(issues.some((i) => i.rule === 'regla-1-fuente-primaria'));
  });

  it('rechaza cita larga de prensa (Regla 9)', () => {
    const largo = new Array(45).fill('palabra').join(' ');
    const issues = validateFuentes(
      'ES-1985-COR-001.yaml',
      [
        {
          tipo: 'boe',
          url: 'https://www.boe.es/ejemplo',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 1,
          fragmento: 'Documento oficial del BOE.',
        },
        {
          tipo: 'prensa',
          url: 'https://ejemplo.es/articulo',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: null,
          fragmento: largo,
        },
      ],
      'publicada',
    );
    assert.ok(issues.some((i) => i.rule === 'regla-9-cita-prensa'));
  });

  it('rechaza estado procesal condenado_firme sin sentencia acreditativa (Regla 3)', () => {
    const ficha = makeValidFicha({
      id: 'ES-1985-COR-002',
      categoria: 'COR',
      estado_procesal: {
        actual: 'condenado_firme',
        historial: [
          {
            fecha: '1988-05-10',
            estado: 'condenado_firme',
            documento: 'https://www.boe.es/eli/es/lo/1985/07/01/6',
          },
        ],
      },
    });
    const issues = validateEstadoProcesal('ES-1985-COR-002.yaml', ficha);
    assert.ok(issues.some((i) => i.rule === 'regla-3-estado-documento'));
  });

  it('exige que absoluciones y archivos figuren en la primera oración del resumen (Regla 4)', () => {
    const ficha = makeValidFicha({
      id: 'ES-1985-COR-003',
      categoria: 'COR',
      estado_procesal: {
        actual: 'archivado',
        historial: [
          {
            fecha: '1986-11-20',
            estado: 'archivado',
            documento: 'https://www.poderjudicial.es/auto-ejemplo',
          },
        ],
      },
      resumen:
        'La Fiscalía presentó una querella en 1984 contra los consejeros. Dos años después el tribunal acordó el archivo.',
      fuentes: [
        {
          tipo: 'auto',
          subtipo: 'auto_sobreseimiento',
          url: 'https://www.poderjudicial.es/auto-ejemplo',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 4,
          fragmento: 'Se acuerda el sobreseimiento libre y archivo de las actuaciones iniciadas en 1984.',
        },
      ],
    });
    const issues = validateEstadoProcesal('ES-1985-COR-003.yaml', ficha);
    assert.ok(issues.some((i) => i.rule === 'regla-4-primera-linea'));

    // Ahora con la absolución/archivo en primera línea: debe pasar
    ficha.resumen =
      'La Audiencia archivó la causa mediante auto de sobreseimiento en 1986 tras la querella presentada en 1984.';
    const issuesOk = validateEstadoProcesal('ES-1985-COR-003.yaml', ficha);
    assert.equal(issuesOk.length, 0);
  });

  it('exige pesetas (ESP) y conversión a 166,386 ptas/€ antes de 2002 (Regla 8)', () => {
    const badEur = validateCifras(
      'ES-1985-SOC-001.yaml',
      [
        {
          concepto: 'Coste presupuestario',
          valor: 1000000,
          moneda: 'EUR',
          anio_moneda: 1985,
          fuente: 'https://www.boe.es/ejemplo',
        },
      ],
      'publicada',
    );
    assert.ok(badEur.some((i) => i.rule === 'regla-8-pesetas-pre-2002'));

    const badConv = validateCifras(
      'ES-1985-SOC-001.yaml',
      [
        {
          concepto: 'Coste presupuestario',
          valor: 166386000,
          moneda: 'ESP',
          anio_moneda: 1985,
          valor_eur_conversion: 900000,
          fuente: 'https://www.boe.es/ejemplo',
        },
      ],
      'publicada',
    );
    assert.ok(badConv.some((i) => i.rule === 'regla-8-conversion-exacta'));

    const okEsp = validateCifras(
      'ES-1985-SOC-001.yaml',
      [
        {
          concepto: 'Coste presupuestario',
          valor: 166386000,
          moneda: 'ESP',
          anio_moneda: 1985,
          valor_eur_conversion: 1000000,
          fuente: 'https://www.boe.es/ejemplo',
        },
      ],
      'publicada',
    );
    assert.equal(okEsp.length, 0);
  });

  it('detecta cifras y entidades del resumen ausentes en los fragmentos de fuentes primarias (§5)', () => {
    const issues = validateCoberturaResumen(
      'ES-1985-SOC-002.yaml',
      'El Ministerio destinó 450000 millones de pesetas en 1985 según el informe del TCU.',
      [
        {
          tipo: 'boe',
          url: 'https://www.boe.es/ejemplo',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 1,
          fragmento: 'Resolución publicada en 1985 relativa a la reestructuración del sector.',
        },
      ],
    );
    assert.ok(issues.some((i) => i.rule === 'cobertura-cifras'));
    assert.ok(issues.some((i) => i.rule === 'cobertura-entidades'));
  });

  it('valida series CSV y detecta filas sin gobierno o sin fuente', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'invariante-csv-'));
    try {
      const seriesDir = path.join(tmp, 'series');
      fs.mkdirSync(seriesDir, { recursive: true });
      fs.writeFileSync(
        path.join(seriesDir, 'decretos_ley.csv'),
        'anio,gobierno,partido_gobierno,valor,unidad,fuente_url,notas\n1985,,PSOE,6,decretos-ley,no-url,nota\n',
      );
      const res = validateRepository({ contentDir: tmp });
      assert.ok(res.errors.some((e) => e.rule === 'csv-gobierno'));
      assert.ok(res.errors.some((e) => e.rule === 'csv-fuente-url'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
