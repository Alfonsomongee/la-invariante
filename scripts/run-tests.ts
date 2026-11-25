import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT_DIR, 'tests');

function collectTests(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTests(full));
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) files.push(full);
  }
  return files.sort();
}

const testFiles = collectTests(TESTS_DIR);
if (testFiles.length === 0) {
  console.log('No se encontraron archivos *.test.ts en tests/.');
  process.exit(0);
}

const tsxCli = path.join(ROOT_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const res = spawnSync(process.execPath, [tsxCli, '--test', ...testFiles], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
});
process.exit(res.status ?? 1);
