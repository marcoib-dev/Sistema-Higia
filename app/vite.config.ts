import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { pluginIA } from './server/pluginIA';

export default defineConfig(({ mode }) => {
  // La clave de la IA se lee de app/.env.local y queda solo del lado del servidor.
  const env = loadEnv(mode, process.cwd(), 'ANTHROPIC_');
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

  return {
    plugins: [react(), pluginIA()],
    test: { environment: 'node' },
  } as never;
});
