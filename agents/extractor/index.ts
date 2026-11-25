import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ROOT_DIR } from '../lib/env.js';
import { extractFencedBlock, loadPrompt, writeReport, writeYamlFile } from '../lib/io.js';
import { callLlm } from '../lib/llm.js';
import { validateRepository } from '../../scripts/validate.js';
import type { StoredDocument } from '../lib/storage.js';

export interface ExtractorArgs {
  manifestPath?: string;
  docTextPath?: string;
  anio: number;
  tipo?: 'ficha' | 'promesa' | 'votacion';
  idSugerido?: string;
  promptOnly?: boolean;
}

export async function runExtractor(args: ExtractorArgs): Promise<{
  outputPath?: string;
  promptOnly: boolean;
  rawOutput: string;
}> {
  const tipo = args.tipo ?? 'ficha';
  const schemaPath = path.join(ROOT_DIR, 'schema', `${tipo}.schema.json`);
  const schemaText = fs.readFileSync(schemaPath, 'utf8');
  const systemPrompt = loadPrompt('extractor');

  let manifestInfo = 'Sin manifiesto adjunto (proporciona sha256 real antes de pasar a revision/publicada).';
  let docExcerpt = '';

  if (args.manifestPath) {
    const absManifest = path.resolve(args.manifestPath);
    const manifest = JSON.parse(fs.readFileSync(absManifest, 'utf8')) as StoredDocument;
    manifestInfo = JSON.stringify(
      {
        url: manifest.url,
        sha256: manifest.sha256,
        capturado: manifest.capturado,
        contentType: manifest.contentType,
        waybackUrl: manifest.waybackUrl,
      },
      null,
      2,
    );
    if (fs.existsSync(manifest.localPath)) {
      const rawBuf = fs.readFileSync(manifest.localPath);
      const isText =
        manifest.contentType.includes('xml') ||
        manifest.contentType.includes('json') ||
        manifest.contentType.includes('html') ||
        manifest.contentType.includes('text');
      if (isText) {
        docExcerpt = rawBuf.toString('utf8').slice(0, 60000);
      } else {
        docExcerpt = `[Documento binario ${manifest.contentType}, ${manifest.bytes} bytes en ${manifest.localPath}. Extrae texto antes con --doc-text.]`;
      }
    }
  }

  if (args.docTextPath) {
    docExcerpt = fs.readFileSync(path.resolve(args.docTextPath), 'utf8').slice(0, 80000);
  }

  const userPrompt = [
    `Año objetivo del anuario: ${args.anio}`,
    `Tipo de documento destino: ${tipo}`,
    args.idSugerido ? `ID sugerido: ${args.idSugerido}` : 'Asigna un ID con formato ES-AAAA-CAT-NNN.',
    `## Metadatos del documento primario recolectado\n\`\`\`json\n${manifestInfo}\n\`\`\``,
    `## Esquema JSON obligatorio (${tipo}.schema.json)\n\`\`\`json\n${schemaText}\n\`\`\``,
    `## Contenido del documento primario\n${docExcerpt || '(Adjunta texto del documento primario con --manifest o --doc-text)'}`,
  ].join('\n\n');

  const response = await callLlm({
    role: 'extractor',
    systemPrompt,
    userPrompt,
    promptOnly: args.promptOnly,
  });

  if (response.promptOnly) {
    const out = writeReport('extractor', `prompt-${args.anio}-${tipo}.md`, response.text);
    return { outputPath: out, promptOnly: true, rawOutput: response.text };
  }

  const yamlText = extractFencedBlock(response.text, 'yaml');
  const parsed = yaml.load(yamlText) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
    throw new Error('La salida del Extractor no contiene un YAML de ficha válido con campo "id".');
  }

  // Regla dura: el Extractor siempre produce borrador
  parsed.estado_ficha = 'borrador';

  const folder = tipo === 'promesa' ? 'promesas' : tipo === 'votacion' ? 'votaciones' : 'fichas';
  const outPath = path.join(ROOT_DIR, 'content', folder, String(args.anio), `${parsed.id}.yaml`);
  writeYamlFile(outPath, parsed);

  const validation = validateRepository({ files: [outPath], enforceDirectoryMatch: true });
  if (validation.errors.length > 0) {
    console.warn(`Aviso: la ficha borrador ${outPath} requiere ajustes tras extracción:`);
    for (const err of validation.errors) {
      console.warn(`  - (${err.rule}) ${err.message}`);
    }
  }

  return { outputPath: outPath, promptOnly: false, rawOutput: response.text };
}
