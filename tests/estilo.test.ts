import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintDocument, loadBlacklist } from '../scripts/estilo/lint.js';

describe('Linter de estilo (scripts/estilo/lint.ts)', () => {
  const blacklist = loadBlacklist();

  it('aprueba un título y resumen neutros dentro del límite de 60 palabras', () => {
    const issues = lintDocument(
      'ES-1985-DEC-001.yaml',
      {
        titulo: 'Aprobación del Real Decreto-ley 2/1985 de medidas de política económica',
        resumen:
          'El Consejo de Ministros aprobó el Real Decreto-ley 2/1985, de 30 de abril, publicado en el BOE el 9 de mayo de 1985, que suprimió la prórroga forzosa en los nuevos contratos de arrendamiento urbano.',
        estado_procesal: { actual: 'no_judicial', historial: [] },
      },
      blacklist,
    );
    assert.equal(issues.length, 0, `Errores inesperados: ${JSON.stringify(issues)}`);
  });

  it('rechaza adjetivos valorativos de la lista negra (Regla 6)', () => {
    const issues = lintDocument(
      'ES-1985-COR-001.yaml',
      {
        titulo: 'Escandaloso contrato polémico en el ministerio',
        resumen: 'Una decisión brutal y opaca provocó un gasto bochornoso en 1985.',
        estado_procesal: { actual: 'no_judicial', historial: [] },
      },
      blacklist,
    );
    assert.ok(issues.some((i) => i.rule === 'estilo-adjetivos' && i.message.includes('titulo')));
    assert.ok(issues.some((i) => i.rule === 'estilo-adjetivos' && i.message.includes('resumen')));
  });

  it('rechaza resúmenes que superan las 60 palabras (Regla 7)', () => {
    const resumenLargo = new Array(65).fill('documento').join(' ');
    const issues = lintDocument(
      'ES-1985-DEC-002.yaml',
      {
        titulo: 'Decreto de prueba',
        resumen: resumenLargo,
      },
      blacklist,
    );
    assert.ok(issues.some((i) => i.rule === 'estilo-longitud'));
  });

  it('rechaza escalada del léxico procesal en causas investigadas o archivadas', () => {
    const issuesInvestigado = lintDocument(
      'ES-1985-COR-009.yaml',
      {
        titulo: 'El exdirector malversó fondos y fue procesado en 1985',
        resumen: 'El investigado fue condenado en prensa por los hechos.',
        estado_procesal: { actual: 'investigado', historial: [] },
      },
      blacklist,
    );
    assert.ok(issuesInvestigado.some((i) => i.rule === 'estilo-lexico-procesal'));
    assert.ok(issuesInvestigado.some((i) => i.rule === 'estilo-lexico-fase'));

    const issuesNoFirme = lintDocument(
      'ES-1985-COR-010.yaml',
      {
        titulo: 'Sentencia firme contra el exconcejal',
        resumen: 'El juzgado dictó condena firme en 1988.',
        estado_procesal: { actual: 'condenado_no_firme', historial: [] },
      },
      blacklist,
    );
    assert.ok(issuesNoFirme.some((i) => i.rule === 'estilo-lexico-firmeza'));
  });
});
