import { execFileSync } from 'node:child_process';
import { getEnv, ROOT_DIR } from './env.js';

export interface CreatePrOptions {
  branchName: string;
  title: string;
  body: string;
  files: string[];
  labels?: string[];
  comments?: string[];
  dryRun?: boolean;
}

/**
 * Regla 10 de CLAUDE.md: Ningún agente publica.
 * Este módulo únicamente crea rama, commit y Pull Request con informes como comentario.
 * NUNCA fusiona PRs ni hace push directo a main.
 */
export async function openPullRequest(options: CreatePrOptions): Promise<{
  branch: string;
  prUrl?: string;
  dryRun: boolean;
}> {
  if (options.branchName === 'main' || options.branchName === 'master') {
    throw new Error('Regla 10: ningún agente puede escribir directamente en main.');
  }

  if (options.dryRun) {
    console.log(`[dry-run] Rama propuesta: ${options.branchName}`);
    console.log(`[dry-run] Título PR: ${options.title}`);
    console.log(`[dry-run] Archivos: ${options.files.join(', ')}`);
    return { branch: options.branchName, dryRun: true };
  }

  const runGit = (args: string[]) =>
    execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'pipe' }).trim();

  runGit(['checkout', '-B', options.branchName]);
  runGit(['add', ...options.files]);
  runGit(['commit', '-m', options.title]);
  runGit(['push', '-u', 'origin', options.branchName]);

  const token = getEnv('GITHUB_TOKEN');
  const repo = getEnv('GITHUB_REPOSITORY');

  if (!token || !repo) {
    console.log(
      `Rama ${options.branchName} publicada en origin. Configura GITHUB_TOKEN y GITHUB_REPOSITORY para abrir el PR automáticamente.`,
    );
    return { branch: options.branchName, dryRun: false };
  }

  const apiBase = `https://api.github.com/repos/${repo}`;
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28',
  };

  const prResp = await fetch(`${apiBase}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: options.title,
      head: options.branchName,
      base: 'main',
      body: options.body,
      draft: true,
    }),
  });

  if (!prResp.ok) {
    throw new Error(`Error al abrir PR en GitHub (${prResp.status}): ${await prResp.text()}`);
  }

  const pr = (await prResp.json()) as { number: number; html_url: string };

  if (options.labels && options.labels.length > 0) {
    await fetch(`${apiBase}/issues/${pr.number}/labels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ labels: options.labels }),
    });
  }

  for (const comment of options.comments ?? []) {
    await fetch(`${apiBase}/issues/${pr.number}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: comment }),
    });
  }

  return { branch: options.branchName, prUrl: pr.html_url, dryRun: false };
}
