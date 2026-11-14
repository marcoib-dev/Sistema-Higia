/**
 * IA DE HIGIA — capa opcional que corre en la computadora del hábitat (aquí: el servidor de desarrollo).
 * Solo se usa con conexión; sin ella, la app sigue con el intérprete local.
 * La clave de API vive en el servidor (app/.env.local) y nunca llega al navegador.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod';
import {
  SENSORES_CONVERSACION,
  type AnalisisEntorno, type PeticionConversacion, type PeticionEntorno, type RespuestaConversacion,
} from '../src/adaptadores/ia/contrato';

export const MODELO = 'claude-opus-5-5';

export class ErrorIA extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

let cliente: Anthropic | null = null;
function obtenerCliente(): Anthropic {
  cliente ??= new Anthropic();
  return cliente;
}

export function iaConfigurada(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// ── Conversación (NUI) ─────────────────────────────────────────────────

const SISTEMA_CONVERSACION = `Eres Higia, el sistema de monitoreo de salud de un hábitat espacial. Conversas por voz, en español, con un astronauta.

Cómo responder:
- Breve y natural: de una a tres oraciones, pensadas para escucharse por un auricular. Sin markdown, listas ni emojis.
- No diagnosticas. El motor de detección de Higia ya evaluó los datos: básate en los hallazgos que llegan en <estado> y no inventes cifras ni datos que no estén ahí. Si falta un dato, dilo.
- Adapta el lenguaje al perfil que llega en <estado>: sin formación médica, evita cifras y tecnicismos y di qué hacer; con formación médica, puedes dar cifras.
- Si el perfil es propenso al pánico o tiene baja tolerancia al estrés, no nombres el pánico ni uses palabras alarmantes; habla con calma.
- Si hay una alerta activa, prioriza la acción de seguridad por encima de cualquier otra conversación.
- Los hallazgos marcados como sensibles (ánimo, estrés) se tratan con tacto.
- Si te habla de algo ajeno a su salud, responde brevemente y con amabilidad.

Registro de datos: si el astronauta menciona un dato que puede registrarse (horas dormidas, ánimo del 1 al 10, minutos de ejercicio que acaba de hacer), inclúyelo en "lecturas". Si no menciona ninguno, deja "lecturas" vacía. No conviertas impresiones vagas en números: "dormí mal" no es un número de horas.`;

const EsquemaConversacion = z.object({
  respuesta: z.string(),
  lecturas: z.array(z.object({ sensor: z.enum(SENSORES_CONVERSACION), valor: z.number() })),
});

export async function conversar(p: PeticionConversacion): Promise<RespuestaConversacion> {
  const messages: Anthropic.Beta.BetaMessageParam[] = p.historial.slice(-12).map((t) => ({
    role: t.rol === 'astronauta' ? 'user' : 'assistant',
    content: t.texto,
  }));
  while (messages.length && messages[0].role !== 'user') messages.shift(); // la conversación debe empezar por el usuario
  messages.push({
    role: 'user',
    content: `<estado>\n${JSON.stringify(p.estado)}\n</estado>\n\n${p.frase}`,
  });

  const r = await obtenerCliente().beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SISTEMA_CONVERSACION,
    output_config: { effort: 'low', format: betaZodOutputFormat(EsquemaConversacion) },
    messages,
  });
  if (r.stop_reason === 'refusal') throw new ErrorIA('La IA no pudo responder a esa frase.', 422);
  if (!r.parsed_output) throw new ErrorIA('La IA devolvió una respuesta que no se pudo interpretar.', 502);
  return r.parsed_output;
}

// ── Entorno por cámara ─────────────────────────────────────────────────

const SISTEMA_ENTORNO = `Eres el módulo de visión de Higia, un sistema de monitoreo de salud para hábitats espaciales.
Recibes una foto de la cámara del astronauta y el contexto que Higia cree actual. Tu trabajo es dar contexto, no diagnosticar.

- Describe en una o dos oraciones qué se ve que sea relevante para la seguridad o la salud.
- Infiere ubicación (hábitat, EVA, rover), destino (órbita, Luna, Marte) y actividad (reposo, trabajo, ejercicio) solo si la imagen lo muestra con claridad; si no, usa "desconocida"/"desconocido". Una foto de un interior terrestre corriente no indica destino.
- En "peligros", enumera riesgos visibles (persona caída, humo, sangre, equipo suelto, poca luz…). Lista vacía si no hay.
- En "recomendacion", una oración breve sobre qué debería tener en cuenta Higia. Escribe en español.`;

const EsquemaEntorno = z.object({
  descripcion: z.string(),
  ubicacion: z.enum(['habitat', 'eva', 'rover', 'desconocida']),
  destino: z.enum(['orbita', 'luna', 'marte', 'desconocido']),
  actividad: z.enum(['reposo', 'trabajo', 'ejercicio', 'desconocida']),
  peligros: z.array(z.string()),
  recomendacion: z.string(),
});

export async function analizarEntorno(p: PeticionEntorno): Promise<AnalisisEntorno> {
  const r = await obtenerCliente().beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SISTEMA_ENTORNO,
    output_config: { effort: 'medium', format: betaZodOutputFormat(EsquemaEntorno) },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.imagen } },
        { type: 'text', text: `Contexto actual según Higia: ${JSON.stringify(p.contexto)}` },
      ],
    }],
  });
  if (r.stop_reason === 'refusal') throw new ErrorIA('La IA no pudo analizar esta imagen.', 422);
  if (!r.parsed_output) throw new ErrorIA('La IA devolvió un análisis que no se pudo interpretar.', 502);
  return r.parsed_output;
}

/** Traduce los errores del SDK a mensajes claros para la UI. */
export function traducirError(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e;
  if (e instanceof Anthropic.AuthenticationError) return new ErrorIA('Clave de API inválida. Revisa app/.env.local.', 401);
  if (e instanceof Anthropic.RateLimitError) return new ErrorIA('Límite de uso de la API alcanzado; intenta en un momento.', 429);
  if (e instanceof Anthropic.BadRequestError) return new ErrorIA(`Petición rechazada por la API: ${e.message}`, 400);
  if (e instanceof Anthropic.APIConnectionError) return new ErrorIA('Sin conexión con la API de IA.', 503);
  if (e instanceof Anthropic.APIError) return new ErrorIA(`Error de la API de IA (${e.status}).`, 502);
  if (!iaConfigurada()) return new ErrorIA('IA no configurada: agrega ANTHROPIC_API_KEY en app/.env.local.', 503);
  return new ErrorIA(e instanceof Error ? e.message : 'Error desconocido en la IA.', 500);
}
