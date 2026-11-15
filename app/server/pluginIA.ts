/**
 * Monta la IA (ver manejador.ts) como endpoints del servidor de desarrollo de Vite.
 * En producción en Vercel la sirve la función de server/vercel.ts.
 * Un build estático sin servidor (`npm run build`) funciona sin IA, en modo local.
 */
import type { Plugin } from 'vite';
import { manejarIA } from './manejador';

export function pluginIA(): Plugin {
  return {
    name: 'higia-ia',
    configureServer(server) {
      server.middlewares.use('/api/ia', (req, res) => {
        void manejarIA(req, res, (req.url ?? '').split('?')[0], (m) => server.config.logger.error(m));
      });
    },
  };
}
