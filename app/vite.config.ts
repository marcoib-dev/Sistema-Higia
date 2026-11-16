import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import { pluginIA } from './server/pluginIA';

// Versión instalada del motor ONNX: la voz Piper baja su .wasm de jsDelivr con esta misma versión.
const ORT_VERSION = (JSON.parse(readFileSync(new URL('./node_modules/onnxruntime-web/package.json', import.meta.url), 'utf-8')) as { version: string }).version;

export default defineConfig(({ mode }) => {
  // La clave de la IA se lee de app/.env.local y queda solo del lado del servidor.
  const env = loadEnv(mode, process.cwd(), 'DEEPSEEK_');
  // Asignación directa: con `??=` una clave vacía (`DEEPSEEK_API_KEY=`) se quedaba pegada en
  // process.env y el servidor seguía creyendo que no había IA tras editar el .env.
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

  return {
    plugins: [react(), pluginIA()],
    define: { __ORT_VERSION__: JSON.stringify(ORT_VERSION) },
    test: { environment: 'node' },
  } as never;
});
