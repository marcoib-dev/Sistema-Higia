/**
 * Monta la IA como endpoints del servidor de desarrollo de Vite:
 *   GET  /api/ia/estado     → ¿hay clave configurada?
 *   POST /api/ia/conversar  → conversación natural
 *   POST /api/ia/entorno    → análisis de una foto de la cámara
 * Solo existe con `npm run dev`. Un build estático (`npm run build`) funciona sin IA, en modo local.
 */
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';
import { analizarEntorno, conversar, iaConfigurada, MODELO, traducirError } from './ia';

const MAX_BYTES = 5 * 1024 * 1024;

function leerJSON(req: IncomingMessage): Promise<never> {
  return new Promise((resolve, reject) => {
    let tamano = 0;
    const partes: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      tamano += c.length;
      if (tamano > MAX_BYTES) reject(new Error('Petición demasiado grande.'));
      else partes.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8'))); } catch { reject(new Error('JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

export function pluginIA(): Plugin {
  return {
    name: 'higia-ia',
    configureServer(server) {
      server.middlewares.use('/api/ia', async (req, res) => {
        const enviar = (status: number, datos: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(datos));
        };
        try {
          if (req.method === 'GET' && req.url === '/estado') return enviar(200, { configurada: iaConfigurada(), modelo: MODELO });
          if (req.method !== 'POST') return enviar(405, { error: 'Método no permitido.' });
          if (req.url === '/conversar') return enviar(200, await conversar(await leerJSON(req)));
          if (req.url === '/entorno') return enviar(200, await analizarEntorno(await leerJSON(req)));
          return enviar(404, { error: 'Ruta no encontrada.' });
        } catch (e) {
          const err = traducirError(e);
          server.config.logger.error(`[higia-ia] ${err.message}`);
          return enviar(err.status, { error: err.message });
        }
      });
    },
  };
}
