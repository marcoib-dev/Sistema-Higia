/**
 * IA DE HIGIA — capa opcional que corre en la computadora del hábitat (aquí: el servidor de desarrollo).
 * Solo se usa con conexión; sin ella, la app sigue con el intérprete local.
 * Usa la API de DeepSeek (formato compatible con OpenAI) con el modelo DeepSeek-V4.1-Flash en modo de
 * pensamiento con esfuerzo bajo. La clave de API vive en el servidor (app/.env.local) y nunca llega al navegador.
 */
import * as z from 'zod';
import {
  SENSORES_CONVERSACION,
  type AnalisisEntorno, type EvaluacionIA, type PeticionConversacion, type PeticionEntorno, type PeticionEvaluacion,
  type RespuestaConversacion,
} from '../src/adaptadores/ia/contrato';

/** `deepseek-flash` es el nombre de API de DeepSeek-V4.1-Flash. */
export const MODELO = 'deepseek-flash';
const URL_BASE = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const ESFUERZO = 'low';

export class ErrorIA extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function iaConfigurada(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

// ── Cliente de DeepSeek ────────────────────────────────────────────────

type Contenido = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
interface Mensaje { role: 'system' | 'user' | 'assistant'; content: Contenido }

/** Error HTTP devuelto por la API de DeepSeek. */
class ErrorAPI extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Pide una respuesta en JSON (modo `json_object`, con pensamiento activado en esfuerzo bajo)
 * y la valida con el esquema de Zod.
 */
async function pedirJSON<T>(messages: Mensaje[], esquema: z.ZodType<T>): Promise<T> {
  if (!iaConfigurada()) throw new ErrorIA('IA no configurada: agrega DEEPSEEK_API_KEY en app/.env.local.', 503);

  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: MODELO,
        messages,
        thinking: { type: 'enabled' },
        reasoning_effort: ESFUERZO,
        response_format: { type: 'json_object' },
        max_tokens: 16000,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new ErrorIA(e instanceof Error && e.name === 'TimeoutError' ? 'La IA tardó demasiado en responder.' : 'Sin conexión con la API de IA.', 503);
  }

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ErrorAPI(cuerpo?.error?.message ?? res.statusText, res.status);
  }

  const datos = await res.json() as { choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
  const eleccion = datos.choices?.[0];
  if (eleccion?.finish_reason === 'content_filter') throw new ErrorIA('La IA no pudo responder a esa petición.', 422);
  const texto = eleccion?.message?.content?.trim();
  if (!texto) throw new ErrorIA('La IA devolvió una respuesta vacía.', 502);

  let json: unknown;
  try { json = JSON.parse(texto); } catch { throw new ErrorIA('La IA devolvió una respuesta que no se pudo interpretar.', 502); }
  const r = esquema.safeParse(json);
  if (!r.success) throw new ErrorIA('La IA devolvió una respuesta con un formato inesperado.', 502);
  return r.data;
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

Registro de datos: si el astronauta menciona un dato que puede registrarse (horas dormidas, ánimo del 1 al 10, minutos de ejercicio que acaba de hacer), inclúyelo en "lecturas". Si no menciona ninguno, deja "lecturas" vacía. No conviertas impresiones vagas en números: "dormí mal" no es un número de horas.

Formato de salida: responde SIEMPRE con un único objeto JSON válido, sin texto fuera de él, con esta forma:
{"respuesta": "texto que se le dirá al astronauta", "lecturas": [{"sensor": "horasSueno", "valor": 5}]}
Valores permitidos para "sensor": ${SENSORES_CONVERSACION.map((s) => `"${s}"`).join(', ')}.`;

const EsquemaConversacion = z.object({
  respuesta: z.string(),
  lecturas: z.array(z.object({ sensor: z.enum(SENSORES_CONVERSACION), valor: z.number() })).default([]),
});

export async function conversar(p: PeticionConversacion): Promise<RespuestaConversacion> {
  const historial: Mensaje[] = p.historial.slice(-12).map((t) => ({
    role: t.rol === 'astronauta' ? 'user' : 'assistant',
    content: t.texto,
  }));
  while (historial.length && historial[0].role !== 'user') historial.shift(); // la conversación debe empezar por el usuario

  return pedirJSON([
    { role: 'system', content: SISTEMA_CONVERSACION },
    ...historial,
    { role: 'user', content: `<estado>\n${JSON.stringify(p.estado)}\n</estado>\n\n${p.frase}` },
  ], EsquemaConversacion);
}

// ── Evaluación de hallazgos ─────────────────────────────────────────────

const SISTEMA_EVALUACION = `Eres Higia, el sistema de monitoreo de salud de un hábitat espacial. El motor de reglas de Higia acaba de detectar un hallazgo y ya se lo comunicó al astronauta con un mensaje breve. Tu tarea es escribir una evaluación personalizada, en español, que complemente ese mensaje.

Cómo evaluar:
- Considera el hallazgo junto con el resto del estado que llega en <estado>: otros hallazgos, últimas lecturas, contexto (ubicación, actividad, destino, clima espacial, hora, si hay médico o compañero cerca) y perfil.
- Explica qué significa ahora y si se relaciona con otros hallazgos (por ejemplo, poco sueño y estrés alto). No diagnostiques enfermedades.
- No contradigas el nivel ni la acción de seguridad del motor; puedes concretarla según el contexto. No inventes cifras ni datos que no estén en <estado>.
- Adapta el lenguaje al perfil: sin formación médica, sin cifras ni tecnicismos; con formación médica, puedes dar cifras.
- Si el perfil es propenso al pánico o tiene baja tolerancia al estrés, o el hallazgo es sensible, usa un tono calmado y sin palabras alarmantes.
- "evaluacion": de una a tres oraciones. "recomendacion": una oración con el siguiente paso concreto. Sin markdown ni emojis.

Formato de salida: responde SIEMPRE con un único objeto JSON válido, sin texto fuera de él, con esta forma:
{"evaluacion": "...", "recomendacion": "..."}`;

const EsquemaEvaluacion = z.object({ evaluacion: z.string().min(1), recomendacion: z.string() });

export async function evaluarHallazgo(p: PeticionEvaluacion): Promise<EvaluacionIA> {
  return pedirJSON([
    { role: 'system', content: SISTEMA_EVALUACION },
    {
      role: 'user',
      content: `<estado>\n${JSON.stringify(p.estado)}\n</estado>\n\n<hallazgo>\n${JSON.stringify(p.hallazgo)}\n</hallazgo>\n\n<mensaje_enviado>\n${p.mensaje}\n</mensaje_enviado>`,
    },
  ], EsquemaEvaluacion);
}

// ── Entorno por cámara ─────────────────────────────────────────────────

const SISTEMA_ENTORNO = `Eres el módulo de visión de Higia, un sistema de monitoreo de salud para hábitats espaciales.
Recibes una foto de la cámara del astronauta y el contexto que Higia cree actual. Tu trabajo es dar contexto, no diagnosticar.

- Describe en una o dos oraciones qué se ve que sea relevante para la seguridad o la salud.
- Infiere ubicación (hábitat, EVA, rover), destino (órbita, Luna, Marte) y actividad (reposo, trabajo, ejercicio) solo si la imagen lo muestra con claridad; si no, usa "desconocida"/"desconocido". Una foto de un interior terrestre corriente no indica destino.
- En "peligros", enumera riesgos visibles (persona caída, humo, sangre, equipo suelto, poca luz…). Lista vacía si no hay.
- En "recomendacion", una oración breve sobre qué debería tener en cuenta Higia. Escribe en español.

Formato de salida: responde SIEMPRE con un único objeto JSON válido, sin texto fuera de él, con esta forma:
{"descripcion": "...", "ubicacion": "habitat", "destino": "luna", "actividad": "trabajo", "peligros": ["..."], "recomendacion": "..."}
Valores permitidos: ubicacion ∈ "habitat" | "eva" | "rover" | "desconocida"; destino ∈ "orbita" | "luna" | "marte" | "desconocido"; actividad ∈ "reposo" | "trabajo" | "ejercicio" | "desconocida".`;

const EsquemaEntorno = z.object({
  descripcion: z.string(),
  ubicacion: z.enum(['habitat', 'eva', 'rover', 'desconocida']).catch('desconocida'),
  destino: z.enum(['orbita', 'luna', 'marte', 'desconocido']).catch('desconocido'),
  actividad: z.enum(['reposo', 'trabajo', 'ejercicio', 'desconocida']).catch('desconocida'),
  peligros: z.array(z.string()).default([]),
  recomendacion: z.string(),
});

export async function analizarEntorno(p: PeticionEntorno): Promise<AnalisisEntorno> {
  return pedirJSON([
    { role: 'system', content: SISTEMA_ENTORNO },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.imagen}` } },
        { type: 'text', text: `Contexto actual según Higia: ${JSON.stringify(p.contexto)}` },
      ],
    },
  ], EsquemaEntorno);
}

/** Traduce los errores de la API a mensajes claros para la UI. */
export function traducirError(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e;
  if (e instanceof ErrorAPI) {
    switch (e.status) {
      case 401: return new ErrorIA('Clave de API inválida. Revisa DEEPSEEK_API_KEY en app/.env.local.', 401);
      case 402: return new ErrorIA('Saldo insuficiente en la cuenta de DeepSeek.', 402);
      case 429: return new ErrorIA('Límite de uso de la API alcanzado; intenta en un momento.', 429);
      case 400: case 422: return new ErrorIA(`Petición rechazada por la API: ${e.message}`, 400);
      default: return new ErrorIA(`Error de la API de IA (${e.status}).`, 502);
    }
  }
  if (!iaConfigurada()) return new ErrorIA('IA no configurada: agrega DEEPSEEK_API_KEY en app/.env.local.', 503);
  return new ErrorIA(e instanceof Error ? e.message : 'Error desconocido en la IA.', 500);
}
