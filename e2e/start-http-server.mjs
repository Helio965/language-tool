/**
 * Servidor do projeto "http" dos testes E2E: compila a web em modo http e sobe a API servindo-a,
 * com banco SQLite temporário e IA de demonstração. Nenhum segredo é necessário: em
 * desenvolvimento a API gera um segredo de sessão temporário.
 * E-mails vão para uma caixa de saída local (e2e/.output/http/outbox): nada é enviado de verdade,
 * e os testes leem o link de redefinição de senha dali.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'e2e', '.output', 'http');
const port = process.env.E2E_HTTP_PORT ?? '4311';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

execFileSync('npx', ['vite', 'build', '--mode', 'http', '--outDir', join(out, 'web'), '--emptyOutDir', '--logLevel', 'warn'], {
  cwd: join(root, 'apps', 'web'),
  stdio: 'inherit',
});

const server = spawn('npx', ['tsx', '--no-warnings=ExperimentalWarning', 'src/server.ts'], {
  cwd: join(root, 'apps', 'api'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    API_PORT: port,
    CORS_ORIGIN: `http://localhost:${port}`,
    DATABASE_PATH: join(out, 'e2e.db'),
    WEB_DIST_PATH: join(out, 'web'),
    AI_PROVIDER: 'mock',
    AUTH_TOKEN_SECRET: '',
    MAIL_TRANSPORT: 'outbox',
    MAIL_OUTBOX_DIR: join(out, 'outbox'),
    APP_PUBLIC_URL: `http://localhost:${port}`,
    SMTP_HOST: '',
  },
});

const stop = () => server.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('exit', (code) => process.exit(code ?? 0));
