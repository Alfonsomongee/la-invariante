import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ROOT_DIR } from './env.js';

export function loadPrompt(name: string, vars: Record<string, string | number> = {}): string {
  const promptPath = path.join(ROOT_DIR, 'agents', 'prompts', `${name}.md`);
  if (!fs.existsSync(promptPath)) {
    throw new Error(`No existe el prompt versionado: ${promptPath}`);
  }
  let text = fs.readFileSync(promptPath, 'utf8');
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{{${k}}}`, String(v));
  }
  return text;
}

export function readYamlFile<T = Record<string, unknown>>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.load(raw) as T;
}

export function writeYamlFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const dumped = yaml.dump(data, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  fs.writeFileSync(filePath, dumped, 'utf8');
}

export function writeReport(subDir: string, fileName: string, content: string): string {
  const outDir = path.join(ROOT_DIR, 'reports', subDir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, content, 'utf8');
  return outPath;
}

export function findContentFileById(id: string): string | null {
  const match = id.match(/^ES-(\d{4})-([A-Z]{3})-\d{3}$/);
  if (!match) return null;
  const [, year, cat] = match;
  const subdirs =
    cat === 'PRM'
      ? ['promesas', 'fichas']
      : cat === 'VOT'
        ? ['votaciones', 'fichas']
        : ['fichas'];

  for (const sub of subdirs) {
    const candidate = path.join(ROOT_DIR, 'content', sub, year, `${id}.yaml`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function extractFencedBlock(text: string, lang: 'yaml' | 'json'): string {
  const regex = new RegExp(`\`\`\`(?:${lang})?\\s*([\\s\\S]*?)\`\`\``, 'i');
  const match = text.match(regex);
  return (match ? match[1] : text).trim();
}
