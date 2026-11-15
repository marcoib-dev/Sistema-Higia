/**
 * Endpoints HTTP de la IA, compartidos por el servidor de desarrollo (pluginIA.ts) y la función
 * de Vercel (vercel.ts):
 *   GET  /api/ia/estado     → ¿hay clave configurada?
 *   POST /api/ia/conversar  → conversación natural
 *   POST /api/ia/evaluar    → evaluación personalizada de un hallazgo del motor
 *   POST /api/ia/entorno    → análisis de una foto de la cámara
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { analizarEntorno, conversar, evaluarHallazgo, iaConfigurada, MODELO, traducirError } from './ia';

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

/** Atiende una petición a la IA. `ruta` es lo que va después de /api/ia (p. ej. "/conversar"). */
export async function manejarIA(
  req: IncomingMessage,
  res: ServerResponse,
  ruta: string,
  registrarError: (mensaje: string) => void = console.error,
): Promise<void> {
  const enviar = (status: number, datos: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(datos));
  };
  try {
    if (req.method === 'GET' && ruta === '/estado') return enviar(200, { configurada: iaConfigurada(), modelo: MODELO });
    if (req.method !== 'POST') return enviar(405, { error: 'Método no permitido.' });
    if (ruta === '/conversar') return enviar(200, await conversar(await leerJSON(req)));
    if (ruta === '/evaluar') return enviar(200, await evaluarHallazgo(await leerJSON(req)));
    if (ruta === '/entorno') return enviar(200, await analizarEntorno(await leerJSON(req)));
    return enviar(404, { error: 'Ruta no encontrada.' });
  } catch (e) {
    const err = traducirError(e);
    registrarError(`[higia-ia] ${err.message}`);
    return enviar(err.status, { error: err.message });
  }
}
