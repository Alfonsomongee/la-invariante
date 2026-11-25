import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT_DIR, 'site');
const ASTRO_BIN = path.join(ROOT_DIR, 'node_modules', 'astro', 'astro.js');

const [major, minor] = process.versions.node.split('.').map(Number);
const needsFlag = major === 20 && minor < 19;
const nodeArgs = needsFlag ? ['--experimental-require-module', ASTRO_BIN, 'check'] : [ASTRO_BIN, 'check'];

const res = spawnSync(process.execPath, nodeArgs, {
  cwd: SITE_DIR,
  stdio: 'inherit',
});
process.exit(res.status ?? 1);
