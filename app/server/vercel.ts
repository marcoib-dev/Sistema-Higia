/**
 * Función de Vercel para la IA. scripts/construirVercel.mjs la empaqueta en un solo archivo.
 * La clave DEEPSEEK_API_KEY se configura en Vercel (Settings → Environment Variables) y nunca
 * llega al navegador.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { manejarIA } from './manejador';

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // La regla de config.json reescribe /api/ia/<ruta> a /api/ia?ruta=<ruta>.
  const ruta = url.searchParams.get('ruta') ?? url.pathname.replace(/^\/api\/ia/, '');
  return manejarIA(req, res, '/' + ruta.replace(/^\/+/, ''));
}
