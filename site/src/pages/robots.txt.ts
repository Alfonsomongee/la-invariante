import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') ?? 'https://lainvariante.es';
  const body = `User-agent: *\nAllow: /\n\n# Las páginas con protagonistas cargo_publico: false emiten meta robots noindex (STC 58/2018).\nHost: ${base}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
