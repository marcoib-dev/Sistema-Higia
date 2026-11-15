/**
 * Construye la app para Vercel con la Build Output API (v3):
 *   .vercel/output/static/           → el build de Vite (dist/)
 *   .vercel/output/functions/api/ia  → la IA (server/vercel.ts) empaquetada en un solo archivo
 * Se usa con `npm run build:vercel` (vercel.json lo llama como comando de build).
 */
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const salida = join(raiz, '.vercel', 'output');
const funcion = join(salida, 'functions', 'api', 'ia.func');

await rm(salida, { recursive: true, force: true });
await mkdir(funcion, { recursive: true });

// Archivos estáticos: lo que generó `vite build`.
await cp(join(raiz, 'dist'), join(salida, 'static'), { recursive: true });

// Función: un solo .mjs con zod y el código de src/core incluidos.
await build({
  entryPoints: [join(raiz, 'server', 'vercel.ts')],
  outfile: join(funcion, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'info',
});
await writeFile(join(funcion, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  maxDuration: 60,
}, null, 2));

await writeFile(join(salida, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/api/ia/(.*)$', dest: '/api/ia?ruta=$1' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ],
}, null, 2));

console.log('Listo: .vercel/output');
