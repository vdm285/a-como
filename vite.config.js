import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Stamp the service worker with a build id so every deploy installs a new worker (public/sw.js).
const swVersion = () => ({
  name: 'sw-version',
  apply: 'build',
  closeBundle() {
    const f = resolve('dist/sw.js');
    if (!existsSync(f)) return;
    const id = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    writeFileSync(f, readFileSync(f, 'utf8').replace('__BUILD__', id));
  },
});

// VITE_BASE is set by the Pages workflow (/compa-precio/ while the repo keeps that name).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  server: { port: 5175, host: true },
  plugins: [swVersion()],
});
