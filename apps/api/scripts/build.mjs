// Gera dist/server.js (ESM) com o núcleo @english-ai/core embutido e as dependências npm externas.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith('@english-ai/'));

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL('../src/server.ts', import.meta.url).pathname],
  outfile: new URL('../dist/server.js', import.meta.url).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external,
  logLevel: 'info',
});
copyFileSync(new URL('../src/db/schema.sql', import.meta.url), new URL('../dist/schema.sql', import.meta.url));
