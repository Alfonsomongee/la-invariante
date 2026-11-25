import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertVerificadorDistinctFromExtractor } from '../agents/lib/llm.js';
import { mapCommonsLicense } from '../agents/curador/index.js';
import { sha256Hex } from '../agents/lib/storage.js';
import { loadPrompt } from '../agents/lib/io.js';

describe('Infraestructura de agentes (agents/)', () => {
  it('impide que Verificador y Extractor usen el mismo modelo (§6)', () => {
    const prevExtP = process.env.EXTRACTOR_PROVIDER;
    const prevExtM = process.env.EXTRACTOR_MODEL;
    const prevVerP = process.env.VERIFICADOR_PROVIDER;
    const prevVerM = process.env.VERIFICADOR_MODEL;

    try {
      process.env.EXTRACTOR_PROVIDER = 'anthropic';
      process.env.EXTRACTOR_MODEL = 'claude-sonnet-4-5';
      process.env.VERIFICADOR_PROVIDER = 'anthropic';
      process.env.VERIFICADOR_MODEL = 'claude-sonnet-4-5';
      assert.throws(() => assertVerificadorDistinctFromExtractor(), /Regla §6 violada/);

      process.env.VERIFICADOR_PROVIDER = 'openai';
      process.env.VERIFICADOR_MODEL = 'gpt-4.1';
      assert.doesNotThrow(() => assertVerificadorDistinctFromExtractor());
    } finally {
      if (prevExtP === undefined) delete process.env.EXTRACTOR_PROVIDER;
      else process.env.EXTRACTOR_PROVIDER = prevExtP;
      if (prevExtM === undefined) delete process.env.EXTRACTOR_MODEL;
      else process.env.EXTRACTOR_MODEL = prevExtM;
      if (prevVerP === undefined) delete process.env.VERIFICADOR_PROVIDER;
      else process.env.VERIFICADOR_PROVIDER = prevVerP;
      if (prevVerM === undefined) delete process.env.VERIFICADOR_MODEL;
      else process.env.VERIFICADOR_MODEL = prevVerM;
    }
  });

  it('filtra estrictamente licencias de Wikimedia Commons (Curador §8)', () => {
    assert.equal(mapCommonsLicense('Public domain', ''), 'pd');
    assert.equal(mapCommonsLicense('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'cc0');
    assert.equal(mapCommonsLicense('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), 'cc-by');
    assert.equal(mapCommonsLicense('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'), 'cc-by-sa');

    // Licencias prohibidas
    assert.equal(mapCommonsLicense('CC BY-NC 4.0', ''), null);
    assert.equal(mapCommonsLicense('CC BY-ND 4.0', ''), null);
    assert.equal(mapCommonsLicense('CC BY-NC-SA 4.0', ''), null);
    assert.equal(mapCommonsLicense('Fair use', ''), null);
    assert.equal(mapCommonsLicense('All rights reserved', ''), null);
    assert.equal(mapCommonsLicense('', ''), null);
  });

  it('calcula SHA-256 determinista en formato hexadecimal de 64 caracteres', () => {
    const hash = sha256Hex('documento oficial BOE');
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, sha256Hex('documento oficial BOE'));
  });

  it('carga todos los prompts versionados en agents/prompts/', () => {
    const prompts = [
      'investigador-anuario',
      'extractor',
      'verificador',
      'jurista',
      'editor',
      'curador',
      'vigilante',
      'auditor',
    ];
    for (const name of prompts) {
      const content = loadPrompt(name, { ANIO: 1985 });
      assert.ok(content.includes('version: 1.0.0'), `Falta versión en prompt ${name}`);
    }
  });
});
