import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';
import { validateRepository } from '../scripts/validate.js';
import { lintRepository } from '../scripts/estilo/lint.js';

const VALID_SHA = 'b'.repeat(64);
const ROOT_DIR = path.resolve(import.meta.dirname, '..');

function buildFixtureContentDir(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'invariante-e2e-'));
  fs.mkdirSync(path.join(tmp, 'fichas', '1985'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'promesas', '1985'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'votaciones', '1985'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'anuarios'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'series'), { recursive: true });

  // Anuario 1985 (fixture sintético de prueba)
  fs.writeFileSync(
    path.join(tmp, 'anuarios', '1985.yaml'),
    yaml.dump({
      anio: 1985,
      legislatura: 'II Legislatura',
      moneda_curso: 'ESP',
      gobiernos: [
        {
          presidente: 'Presidente de Prueba',
          partido: 'PSOE',
          tipo_mayoria: 'mayoria_absoluta',
          desde: '1982-12-02',
          hasta: '1986-07-23',
        },
      ],
      composicion_congreso: [
        { partido: 'PSOE', escanos: 202 },
        { partido: 'AP', escanos: 107 },
      ],
      gobiernos_autonomicos: [
        { comunidad: 'Cataluña', presidente: 'Presidencia Autonómica Prueba', partido: 'CiU' },
      ],
      contexto_resumen:
        'Durante 1985 gobernó el PSOE con mayoría absoluta en la II Legislatura y moneda en pesetas.',
      nota_exposicion:
        'Con mayoría absoluta, la mayor parte de los actos ejecutivos estatales corresponden al Gobierno del PSOE.',
      descartes: [
        {
          pista: 'Cita sin documento',
          motivo_descarte: 'Sin fuente primaria fechada.',
          requisito_entrada: 'Localizar Diario de Sesiones o archivo oficial.',
        },
      ],
      fuentes: [
        {
          tipo: 'boe',
          url: 'https://www.boe.es/ejemplo-anuario-1985',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 1,
          fragmento: 'Composición de la II Legislatura publicada en el Boletín Oficial del Estado.',
        },
      ],
      estado_anuario: 'publicado',
      versiones: [{ fecha: '2026-11-25', cambio: 'Creación fixture', motivo: 'Test E2E' }],
    }),
  );

  // 1. Ficha con cargo público + cifra en pesetas pre-2002
  fs.writeFileSync(
    path.join(tmp, 'fichas', '1985', 'ES-1985-SOC-001.yaml'),
    yaml.dump({
      id: 'ES-1985-SOC-001',
      anuario: 1985,
      categoria: 'SOC',
      partidos: ['PSOE'],
      nivel: 'estatal',
      protagonistas: [
        {
          nombre: 'Cargo Publico Prueba',
          cargo_en_el_momento: 'Ministro de Economía',
          cargo_publico: true,
          wikidata: 'Q999999',
        },
      ],
      estado_procesal: { actual: 'no_judicial', historial: [] },
      titulo: 'Asignación presupuestaria de saneamiento en 1985',
      resumen:
        'El Ministerio aprobó una partida de 166386000 pesetas en 1985 según el BOE para saneamiento industrial.',
      descargo: 'El Ministerio defendió la medida como necesaria para sostener el empleo.',
      cifras: [
        {
          concepto: 'Partida de saneamiento',
          valor: 166386000,
          moneda: 'ESP',
          anio_moneda: 1985,
          valor_eur_conversion: 1000000,
          fuente: 'https://www.boe.es/ejemplo-soc-1985',
        },
      ],
      fuentes: [
        {
          tipo: 'boe',
          subtipo: 'norma',
          titulo_documento: 'BOE ejemplo 1985',
          url: 'https://www.boe.es/ejemplo-soc-1985',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 10,
          fragmento:
            'El Ministerio aprueba en 1985 una partida de 166386000 pesetas para saneamiento industrial.',
        },
      ],
      imagen: {
        tipo: 'facsimil',
        licencia: 'art13_trlpi',
        autor: 'Agencia Estatal Boletín Oficial del Estado',
        origen: 'https://www.boe.es/ejemplo-soc-1985',
      },
      estado_ficha: 'publicada',
      versiones: [{ fecha: '2026-11-25', cambio: 'Publicación fixture', motivo: 'Test E2E' }],
    }),
  );

  // 2. Ficha archivada con particular (cargo_publico: false -> STC 58/2018 noindex + sin página de persona)
  fs.writeFileSync(
    path.join(tmp, 'fichas', '1985', 'ES-1985-COR-002.yaml'),
    yaml.dump({
      id: 'ES-1985-COR-002',
      anuario: 1985,
      categoria: 'COR',
      partidos: ['AP'],
      nivel: 'autonomico',
      protagonistas: [
        {
          nombre: 'Particular Privado Prueba',
          cargo_en_el_momento: 'Administrador de sociedad contratista',
          cargo_publico: false,
        },
      ],
      estado_procesal: {
        actual: 'archivado',
        historial: [
          {
            fecha: '1987-04-12',
            estado: 'archivado',
            documento: 'https://www.poderjudicial.es/auto-archivo-1987',
          },
        ],
      },
      titulo: 'Archivo de diligencias sobre contrato autonómico de 1985',
      resumen:
        'El juzgado archivó mediante auto de sobreseimiento en 1987 las diligencias abiertas sobre un contrato autonómico de 1985.',
      descargo: 'La defensa solicitó el sobreseimiento que fue estimado por el juzgado.',
      cifras: [],
      fuentes: [
        {
          tipo: 'auto',
          subtipo: 'auto_sobreseimiento',
          url: 'https://www.poderjudicial.es/auto-archivo-1987',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 3,
          fragmento:
            'Auto de sobreseimiento de 1987 por el que se archivan las diligencias sobre el contrato autonómico de 1985.',
        },
      ],
      imagen: null,
      estado_ficha: 'publicada',
      versiones: [{ fecha: '2026-11-25', cambio: 'Publicación fixture', motivo: 'Test E2E' }],
    }),
  );

  // 3. Ficha en Contraprueba
  fs.writeFileSync(
    path.join(tmp, 'fichas', '1985', 'ES-1985-CTL-003.yaml'),
    yaml.dump({
      id: 'ES-1985-CTL-003',
      anuario: 1985,
      categoria: 'CTL',
      contraprueba: true,
      contraprueba_motivo: 'El tribunal anuló una disposición reglamentaria del Ejecutivo, acreditando control efectivo.',
      partidos: ['PSOE'],
      nivel: 'estatal',
      protagonistas: [],
      estado_procesal: { actual: 'no_judicial', historial: [] },
      titulo: 'Anulación judicial de precepto reglamentario en 1985',
      resumen:
        'El Tribunal Constitucional anuló en 1985 un precepto reglamentario impugnado por falta de cobertura legal.',
      descargo: null,
      descargo_justificacion_null: 'Resolución firme sin recurso posterior.',
      cifras: [],
      fuentes: [
        {
          tipo: 'sentencia',
          subtipo: 'otro',
          url: 'https://hj.tribunalconstitucional.es/ejemplo-1985',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 12,
          fragmento:
            'El Tribunal Constitucional declara nulo en 1985 el precepto reglamentario por carecer de cobertura legal.',
        },
      ],
      imagen: null,
      estado_ficha: 'publicada',
      versiones: [{ fecha: '2026-11-25', cambio: 'Publicación fixture', motivo: 'Test E2E' }],
    }),
  );

  // 4. Ficha retirada (mantiene tombstone, no reutiliza ID)
  fs.writeFileSync(
    path.join(tmp, 'fichas', '1985', 'ES-1985-COR-004.yaml'),
    yaml.dump({
      id: 'ES-1985-COR-004',
      anuario: 1985,
      categoria: 'COR',
      partidos: ['CiU'],
      nivel: 'local',
      protagonistas: [],
      estado_procesal: { actual: 'no_judicial', historial: [] },
      titulo: 'Registro retirado por error de atribución en 1985',
      resumen: 'Ficha retirada tras verificar en 1985 que el expediente correspondía a otro municipio.',
      descargo: null,
      cifras: [],
      fuentes: [
        {
          tipo: 'oficial',
          url: 'https://www.boe.es/ejemplo-retirada',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 1,
          fragmento: 'Certificado oficial de 1985 que acredita el error de atribución municipal.',
        },
      ],
      imagen: null,
      estado_ficha: 'retirada',
      motivo_retirada: 'Error de atribución municipal verificado con certificado oficial.',
      versiones: [{ fecha: '2026-11-25', cambio: 'Retirada', motivo: 'Error documental' }],
    }),
  );

  // 5. Promesa Dijo / Firmó
  fs.writeFileSync(
    path.join(tmp, 'promesas', '1985', 'ES-1985-PRM-001.yaml'),
    yaml.dump({
      id: 'ES-1985-PRM-001',
      anuario: 1985,
      categoria: 'PRM',
      partidos: ['PSOE'],
      nivel: 'estatal',
      titulo: 'Compromiso de 1982 frente a norma aprobada en 1985',
      resumen:
        'El programa electoral de 1982 recogió un compromiso concreto que fue revertido en 1985 mediante norma en el BOE.',
      dijo: {
        fecha: '1982-10-01',
        autor: 'Cargo Publico Prueba',
        cargo_en_el_momento: 'Candidato',
        cargo_publico: true,
        partido: 'PSOE',
        cita_literal: 'Texto literal del programa de 1982.',
        contexto: 'Programa electoral de octubre de 1982.',
        fuente_url: 'https://ejemplo.org/programa-1982',
      },
      firmo: {
        fecha: '1985-06-15',
        organismo: 'Cortes Generales',
        norma_o_acto: 'Ley de prueba de 1985',
        descripcion_factual: 'Norma publicada en el BOE en junio de 1985 en sentido contrario.',
        fuente_url: 'https://www.boe.es/ejemplo-prm-1985',
      },
      descargo: 'El Gobierno alegó cambios en el contexto internacional.',
      fuentes: [
        {
          tipo: 'programa',
          url: 'https://ejemplo.org/programa-1982',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 5,
          fragmento: 'Programa electoral de 1982: Texto literal del programa de 1982.',
        },
        {
          tipo: 'boe',
          url: 'https://www.boe.es/ejemplo-prm-1985',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 2,
          fragmento: 'Norma publicada en el BOE en 1985 que revierte la posición de 1982.',
        },
      ],
      imagen: null,
      estado_ficha: 'publicada',
      versiones: [{ fecha: '2026-11-25', cambio: 'Publicación fixture', motivo: 'Test E2E' }],
    }),
  );

  // 6. Votación «Votan juntos»
  fs.writeFileSync(
    path.join(tmp, 'votaciones', '1985', 'ES-1985-VOT-001.yaml'),
    yaml.dump({
      id: 'ES-1985-VOT-001',
      anuario: 1985,
      categoria: 'VOT',
      partidos: ['PSOE', 'AP'],
      nivel: 'estatal',
      titulo: 'Votación en el Congreso sobre regla electoral en 1985',
      resumen:
        'El Congreso aprobó en 1985 la norma electoral con 280 votos a favor, 20 en contra y 5 abstenciones.',
      sesion: {
        fecha: '1985-06-12',
        legislatura: 'II Legislatura',
        camara: 'congreso',
        asunto: 'Aprobación de ley electoral de prueba',
        norma_resultante: 'Ley Orgánica 5/1985',
      },
      resultado: { a_favor: 280, en_contra: 20, abstenciones: 5, total_emitidos: 305 },
      grupos: [
        { grupo: 'Socialista', partido: 'PSOE', sentido: 'a_favor', a_favor: 190 },
        { grupo: 'Popular', partido: 'AP', sentido: 'a_favor', a_favor: 90 },
        { grupo: 'Mixto', partido: 'PCE', sentido: 'en_contra', en_contra: 20 },
      ],
      descargo: 'Los grupos mayoritarios defendieron la estabilidad parlamentaria.',
      fuentes: [
        {
          tipo: 'diario_sesiones',
          url: 'https://www.congreso.es/ejemplo-ds-1985',
          sha256: VALID_SHA,
          capturado: '2026-11-25',
          pagina: 44,
          fragmento:
            'Resultado de la votación en 1985 en el Congreso: 280 votos a favor, 20 en contra y 5 abstenciones.',
        },
      ],
      imagen: null,
      estado_ficha: 'publicada',
      versiones: [{ fecha: '2026-11-25', cambio: 'Publicación fixture', motivo: 'Test E2E' }],
    }),
  );

  // 7. Serie CSV con dos gobiernos con medias distintas (>35% -> activa Contraprueba)
  fs.copyFileSync(
    path.join(ROOT_DIR, 'content', 'series', 'manifest.yaml'),
    path.join(tmp, 'series', 'manifest.yaml'),
  );
  fs.writeFileSync(
    path.join(tmp, 'series', 'decretos_ley.csv'),
    [
      'anio,gobierno,partido_gobierno,valor,unidad,fuente_url,notas',
      '1981,Calvo-Sotelo,UCD,18,decretos-ley,https://www.boe.es/1981,Dato de prueba',
      '1985,Gonzalez I,PSOE,6,decretos-ley,https://www.boe.es/1985,Dato de prueba',
    ].join('\n') + '\n',
  );

  return tmp;
}

describe('Integración E2E: validación, estilo, compilación Astro, STC 58/2018, SVG y Satori OG', () => {
  it('valida, pasa linter y compila todas las rutas respetando STC 58/2018 y cero JS cliente', () => {
    const tmp = buildFixtureContentDir();
    try {
      const val = validateRepository({ contentDir: tmp });
      assert.equal(val.errors.length, 0, `Errores de validación: ${JSON.stringify(val.errors)}`);

      const lint = lintRepository({ contentDir: tmp });
      assert.equal(lint.errors.length, 0, `Errores de estilo: ${JSON.stringify(lint.errors)}`);

      const astroBin = path.join(ROOT_DIR, 'node_modules', 'astro', 'astro.js');
      const outDir = path.join(tmp, 'dist');
      const build = spawnSync(process.execPath, [astroBin, 'build', '--outDir', outDir], {
        cwd: path.join(ROOT_DIR, 'site'),
        env: { ...process.env, CONTENT_DIR: tmp },
        encoding: 'utf8',
      });
      assert.equal(build.status, 0, `astro build falló:\n${build.stdout}\n${build.stderr}`);

      // Rutas principales generadas
      const socHtml = fs.readFileSync(path.join(outDir, 'fichas', 'ES-1985-SOC-001', 'index.html'), 'utf8');
      assert.ok(socHtml.includes('166.386.000') || socHtml.includes('166386000'));
      assert.ok(socHtml.includes('1.000.000') || socHtml.includes('1000000'));
      // Cero JS cliente en fichas (ADR 0003)
      assert.ok(!/<script\b/i.test(socHtml), 'Una ficha no debe incluir scripts de cliente');

      // STC 58/2018: cargo_publico: false -> noindex + data-pagefind-ignore + SIN página de persona
      const corHtml = fs.readFileSync(path.join(outDir, 'fichas', 'ES-1985-COR-002', 'index.html'), 'utf8');
      assert.ok(corHtml.includes('<meta name="robots" content="noindex, nofollow">'));
      assert.ok(corHtml.includes('data-pagefind-ignore="all"'));
      assert.equal(
        fs.existsSync(path.join(outDir, 'personas', 'particular-privado-prueba', 'index.html')),
        false,
        'No debe generarse página de persona para cargo_publico: false',
      );

      // Cargo público SÍ genera página de persona
      assert.equal(
        fs.existsSync(path.join(outDir, 'personas', 'cargo-publico-prueba', 'index.html')),
        true,
      );

      // Ficha retirada conserva URL con aviso y noindex
      const retiradaHtml = fs.readFileSync(path.join(outDir, 'fichas', 'ES-1985-COR-004', 'index.html'), 'utf8');
      assert.ok(retiradaHtml.includes('Ficha retirada'));
      assert.ok(retiradaHtml.includes('noindex, nofollow'));

      // Promesa Dijo / Firmó y Votación con SVG
      assert.ok(fs.existsSync(path.join(outDir, 'promesas', 'ES-1985-PRM-001', 'index.html')));
      const votHtml = fs.readFileSync(path.join(outDir, 'votaciones', 'ES-1985-VOT-001', 'index.html'), 'utf8');
      assert.ok(votHtml.includes('<svg'));

      // Series SVG y Contraprueba automática
      const seriesHtml = fs.readFileSync(path.join(outDir, 'series', 'index.html'), 'utf8');
      assert.ok(seriesHtml.includes('<svg'));
      assert.ok(seriesHtml.includes('Calvo-Sotelo'));
      const contraHtml = fs.readFileSync(path.join(outDir, 'contraprueba', 'index.html'), 'utf8');
      assert.ok(contraHtml.includes('ES-1985-CTL-003'));
      assert.ok(contraHtml.includes('Reales decretos-ley aprobados por año'));

      // Tarjeta social Satori PNG con cabecera PNG válida
      const ogPngPath = path.join(outDir, 'og', 'ES-1985-SOC-001.png');
      assert.ok(fs.existsSync(ogPngPath));
      const pngBytes = fs.readFileSync(ogPngPath);
      assert.equal(pngBytes[0], 0x89);
      assert.equal(pngBytes[1], 0x50);
      assert.equal(pngBytes[2], 0x4e);
      assert.equal(pngBytes[3], 0x47);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
