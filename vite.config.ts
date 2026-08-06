import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  build: {
    target: 'es2023',
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@render': fileURLToPath(new URL('./src/render', import.meta.url)),
      '@platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
      '@assets': fileURLToPath(new URL('./assets', import.meta.url)),
    },
  },
});
