import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Um único .env na raiz do monorepo. Só variáveis VITE_* chegam ao navegador.
  envDir: '../..',
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3333' },
  },
  preview: { port: 4173 },
  build: { sourcemap: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
