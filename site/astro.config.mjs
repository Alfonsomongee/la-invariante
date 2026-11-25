import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL || 'https://lainvariante.es',
  output: 'static',
  build: {
    format: 'directory',
  },
  vite: {
    ssr: {
      external: ['@resvg/resvg-js'],
    },
  },
});
