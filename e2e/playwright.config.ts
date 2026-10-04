import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta (navegador real) das jornadas críticas, nos dois modos do app:
 * - demo: web no Vite, dados no localStorage, IA de demonstração;
 * - http: web compilada em modo http, servida pela API com SQLite temporário e cookie httpOnly.
 *
 * Rodar: `npx playwright install chromium` (uma vez) e `npm run test:e2e`.
 */
const DEMO_PORT = 4310;
const HTTP_PORT = 4311;

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: './.output/test-results',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  projects: [
    { name: 'demo', testMatch: /demo\.spec\.ts$/, use: { baseURL: `http://localhost:${DEMO_PORT}` } },
    { name: 'http', testMatch: /http\.spec\.ts$/, use: { baseURL: `http://localhost:${HTTP_PORT}` } },
  ],
  webServer: [
    {
      command: `npm run dev -w @english-ai/web -- --port ${DEMO_PORT} --strictPort`,
      cwd: '..',
      url: `http://localhost:${DEMO_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'node e2e/start-http-server.mjs',
      cwd: '..',
      url: `http://localhost:${HTTP_PORT}/api/health`,
      // Sempre um servidor novo: banco limpo e limites de requisição zerados.
      reuseExistingServer: false,
      timeout: 120_000,
      env: { E2E_HTTP_PORT: String(HTTP_PORT) },
    },
  ],
});
