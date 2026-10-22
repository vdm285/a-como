import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Stamp the service worker with a build id so every deploy installs a new worker (public/sw.js).
const swVersion = () => ({
  name: 'sw-version',
  apply: 'build',
  closeBundle() {
    const f = resolve('dist/sw.js');
    if (!existsSync(f)) return;
    const id = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    // precache: every hashed asset, and the files the app needs before its first colours
    const shell = existsSync(resolve('dist/assets')) ? readdirSync(resolve('dist/assets')).map((n) => `./assets/${n}`) : [];
    const boot = ['geo/cdmx.json', 'qqp/meta.json', 'qqp/stores.json', 'qqp/products.json', 'qqp/groups.json', 'qqp/index.json', 'qqp/visits.json']
      .filter((p) => existsSync(resolve('dist/data', p))).map((p) => `./data/${p}`);
    const src = readFileSync(f, 'utf8').replace('__BUILD__', id).replace(/\/\*__PRECACHE__\*\/ \{ shell: \[\], boot: \[\] \}/, JSON.stringify({ shell, boot }));
    writeFileSync(f, src);
  },
});

// VITE_BASE is set by the Pages workflow (/compa-precio/ while the repo keeps that name).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  // data/ holds caches and test-browser profiles whose locked files crash Vite's watcher
  server: { port: 5175, host: true, watch: { ignored: ['**/data/**', '**/dist/**', '**/.git/**'] } },
  plugins: [swVersion()],
});
