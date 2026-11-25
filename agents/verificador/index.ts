import fs from 'node:fs';
import path from 'node:path';
import { findContentFileById, loadPrompt, writeReport } from '../lib/io.js';
import { assertVerificadorDistinctFromExtractor, callLlm } from '../lib/llm.js';

export interface VerificadorArgs {
  ficha: string; // ID (ES-...) o ruta de archivo
  promptOnly?: boolean;
}

export async function runVerificador(args: VerificadorArgs): Promise<{
  reportPath: string;
  veredicto: string;
  reportMarkdown: string;
}> {
  // Regla dura §6: verificar siempre separación de modelos Extractor vs Verificador
  assertVerificadorDistinctFromExtractor();

  const filePath = fs.existsSync(args.ficha)
    ? path.resolve(args.ficha)
    : findContentFileById(args.ficha);

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`No se encontró la ficha "${args.ficha}".`);
  }

  const yamlContent = fs.readFileSync(filePath, 'utf8');
  const baseId = path.basename(filePath, path.extname(filePath));
  const systemPrompt = loadPrompt('verificador');
  const userPrompt = [
    `Audita con criterio adversarial la siguiente ficha candidata (${baseId}).`,
    `## Ficha YAML\n\`\`\`yaml\n${yamlContent}\n\`\`\``,
  ].join('\n\n');

  const response = await callLlm({
    role: 'verificador',
    systemPrompt,
    userPrompt,
    promptOnly: args.promptOnly,
  });

  const header = `<!-- Informe generado por Agente Verificador (${response.provider}:${response.model}) -->\n\n`;
  const reportMarkdown = header + response.text;
  const reportPath = writeReport('verificador', `${baseId}.md`, reportMarkdown);

  const veredictoMatch = response.text.match(/\b(APROBABLE|REQUIERE_CORRECCION|DESCARTAR)\b/);
  const veredicto = response.promptOnly ? 'PROMPT_ONLY' : (veredictoMatch?.[1] ?? 'INDETERMINADO');

  return { reportPath, veredicto, reportMarkdown };
}
