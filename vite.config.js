import { defineConfig } from 'vite';

// VITE_BASE is set by the Pages workflow (/compa-precio/ while the repo keeps that name).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  server: { port: 5175, host: true },
});
