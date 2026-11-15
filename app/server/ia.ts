/**
 * IA DE HIGIA — capa opcional que corre en la computadora del hábitat (aquí: el servidor de desarrollo).
 * Solo se usa con conexión; sin ella, la app sigue con el intérprete local.
 * Usa la API de DeepSeek con el modelo DeepSeek-V4.1-Flash. Las respuestas estructuradas se piden con
 * una herramienta (function calling) forzada, que es la única forma fiable de obtener JSON del modelo.
 * La clave de API vive en el servidor (app/.env o app/.env.local) y nunca llega al navegador.
 */
import * as z from 'zod';
import { validarAcciones } from '../src/core/acciones';
import { INFO_SENSOR } from '../src/core/tipos';
import {
  SENSORES_CONVERSACION,
  type AnalisisEntorno, type EvaluacionIA, type PeticionConversacion, type PeticionEntorno, type PeticionEvaluacion,
  type RespuestaConversacion,
} from '../src/adaptadores/ia/contrato';

/** `deepseek-flash` es el nombre de API de DeepSeek-V4.1-Flash. */
export const MODELO = 'deepseek-flash';
const URL_BASE = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');

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
 * Herramienta (function calling) generada a partir del esquema de Zod. Es la forma fiable de obtener
 * JSON de DeepSeek-V4.1-Flash: su modo `response_format: json_object` devuelve `content` vacío y, sin
 * él, el modelo tiende a responder en prosa. Con una herramienta, el formato lo impone el esquema y la
 * respuesta llega en `tool_calls` (no se fuerza `tool_choice`: el modo de pensamiento no lo admite).
 */
function herramienta<T>(nombre: string, esquema: z.ZodType<T>) {
  return {
    type: 'function' as const,
    function: {
      name: nombre,
      description: 'Devuelve el resultado con el formato exacto que pide el sistema.',
      parameters: z.toJSONSchema(esquema, { io: 'output' }) as Record<string, unknown>,
    },
  };
}

/**
 * Una llamada a la API. Fuerza la herramienta para garantizar el JSON: el modelo tiene que responder
 * llamándola (si no se fuerza, con este prompt largo tiende a contestar en prosa).
 *
 * No se usa el modo de pensamiento: DeepSeek-V4.1-Flash rechaza `tool_choice` cuando piensa
 * ("Thinking mode does not support this tool_choice"), y su `response_format: json_object` devuelve
 * `content` vacío en muchas conversaciones. Sin pensamiento y con la herramienta forzada, el JSON
 * llega siempre en `tool_calls`.
 *
 * Lanza ErrorAPI si la API responde con error y ErrorIA si la respuesta es inservible.
 */
async function pedirUnaVez<T>(messages: Mensaje[], esquema: z.ZodType<T>, nombreHerramienta: string): Promise<T> {
  const cuerpo: Record<string, unknown> = {
    model: MODELO,
    messages,
    tools: [herramienta(nombreHerramienta, esquema)],
    tool_choice: { type: 'function', function: { name: nombreHerramienta } },
    // Hay que desactivarlo explícitamente: si se omite, DeepSeek lo activa por defecto.
    thinking: { type: 'disabled' },
    max_tokens: 16000,
  };

  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new ErrorIA(e instanceof Error && e.name === 'TimeoutError' ? 'La IA tardó demasiado en responder.' : 'Sin conexión con la API de IA.', 503);
  }

  if (!res.ok) {
    const cuerpoError = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ErrorAPI(cuerpoError?.error?.message ?? res.statusText, res.status);
  }

  const datos = await res.json() as {
    choices?: {
      finish_reason?: string;
      message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] };
    }[];
  };
  const eleccion = datos.choices?.[0];
  if (eleccion?.finish_reason === 'content_filter') throw new ErrorIA('La IA no pudo responder a esa petición.', 422);

  // Preferimos la herramienta; si el modelo respondió en texto, se intenta leer el JSON de ahí.
  const llamada = eleccion?.message?.tool_calls?.find((t) => t.function?.name === nombreHerramienta) ?? eleccion?.message?.tool_calls?.[0];
  const texto = llamada?.function?.arguments?.trim() || extraerJSON(eleccion?.message?.content ?? '');
  if (!texto) throw new ErrorIA('La IA devolvió una respuesta vacía.', 502);

  let json: unknown;
  try { json = JSON.parse(texto); } catch { throw new ErrorIA('La IA devolvió una respuesta que no se pudo interpretar.', 502); }
  const r = esquema.safeParse(json);
  if (!r.success) throw new ErrorIA('La IA devolvió una respuesta con un formato inesperado.', 502);
  return r.data;
}

/**
 * Deja solo el objeto JSON de la respuesta: quita los bloques de código con los que a veces
 * el modelo envuelve el JSON y, si hay texto alrededor, toma desde la primera `{` hasta la última `}`.
 */
function extraerJSON(texto: string): string {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  return inicio !== -1 && fin > inicio ? limpio.slice(inicio, fin + 1) : '';
}

/**
 * Pide una respuesta en JSON y la valida con el esquema de Zod.
 *
 * La respuesta se obtiene mediante una herramienta (function calling) cuyo esquema se genera desde
 * Zod. Se reintenta si la respuesta llega vacía o ilegible; los errores de la API no se reintentan.
 */
async function pedirJSON<T>(messages: Mensaje[], esquema: z.ZodType<T>, nombreHerramienta: string): Promise<T> {
  if (!iaConfigurada()) throw new ErrorIA('IA no configurada: agrega DEEPSEEK_API_KEY en app/.env o app/.env.local.', 503);

  let ultimo: ErrorIA | null = null;
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await pedirUnaVez(messages, esquema, nombreHerramienta);
    } catch (e) {
      // Los errores de la API (clave inválida, saldo, límite, petición rechazada) no se reintentan.
      if (!(e instanceof ErrorIA) || e.status !== 502) throw e;
      ultimo = e;
    }
  }
  throw ultimo ?? new ErrorIA('La IA no devolvió una respuesta.', 502);
}

// ── Conversación (NUI) ─────────────────────────────────────────────────

/** Tabla de los datos que se pueden registrar hablando, generada desde el catálogo. */
const TABLA_SENSORES = SENSORES_CONVERSACION.map((s) => {
  if (s === 'minutosEjercicioRealizados') return '- minutosEjercicioRealizados · min · 0–300 · minutos de ejercicio que acaba de hacer';
  const i = INFO_SENSOR[s];
  return `- ${s} · ${i.unidad} · ${i.min}–${i.max} · ${i.ayuda ?? i.nombre}`;
}).join('\n');

const SISTEMA_CONVERSACION = `Eres Higia, el sistema de monitoreo de salud de un hábitat espacial. Conversas por voz, en español, con un astronauta.

Cómo responder:
- Breve y natural: de una a tres oraciones, pensadas para escucharse por un auricular. Sin markdown, listas ni emojis.
- No diagnosticas. El motor de detección de Higia ya evaluó los datos: básate en los hallazgos que llegan en <estado> y no inventes cifras ni datos que no estén ahí. Si falta un dato, dilo.
- Adapta el lenguaje al perfil que llega en <estado>: sin formación médica, evita cifras y tecnicismos y di qué hacer; con formación médica, puedes dar cifras.
- Si el perfil es propenso al pánico o tiene baja tolerancia al estrés, no nombres el pánico ni uses palabras alarmantes; habla con calma.
- Si hay una alerta activa, prioriza la acción de seguridad por encima de cualquier otra conversación.
- Los hallazgos marcados como sensibles (ánimo, estrés) se tratan con tacto.
- Si te habla de algo ajeno a su salud, responde brevemente y con amabilidad.
- Ten en cuenta su historia clínica previa (alergias, antecedentes, medicación) que llega en <estado>.perfil.historiaClinica. Nunca recomiendes algo a lo que es alérgico.
- Uso de datos: cuando hables de su salud, apóyate SOLO en los datos de <estado> (hallazgos, lecturasRecientes con su antigüedad en minutos, lineaBase e historia clínica) y menciona el dato concreto en que te basas (por ejemplo "tu pulso de hace 5 minutos fue 132"; sin cifras si el perfil no tiene formación médica, pero sin inventar). Si no hay datos sobre algo, dilo en vez de suponer.
- Salud mental y neurología, con especial cuidado y sin diagnosticar:
  · Si cuenta percepciones extrañas (oye voces, ve cosas que otros no ven, siente que lo vigilan o persiguen, que controlan sus pensamientos) o su discurso es claramente desorganizado, registra "marcadoresPsicoticos" (0–10: 4–5 una señal leve, 6–7 una señal clara, 8–10 varias o muy intensas). Responde con calma, sin discutir lo que percibe ni darle la razón, y no lo dejes solo: sugiere un lugar tranquilo y que alguien lo acompañe. Si hay riesgo para él o para otros, usa pedir_ayuda.
  · Si parece confundido o desorientado (no sabe dónde está, qué día es, no recuerda qué pasó) o contó un golpe en la cabeza, usa chequeo_orientacion. Un golpe en la cabeza también es emitir_alerta con sistema "cerebro" y region "craneo".

Registro de datos: si el astronauta menciona un dato que puede registrarse, inclúyelo en "lecturas" con el valor en la unidad de la tabla y dentro del rango. Si no menciona ninguno, deja "lecturas" vacía. No conviertas impresiones vagas en números: "dormí mal" no es un número de horas.
- Los síntomas (los datos que empiezan con "sx") se devuelven como lecturas con su intensidad de 0 a 10: 3 si es leve ("un poco", "algo"), 5 si no dice, 8 si es fuerte ("mucho", "intenso", "insoportable"), o el número si lo da ("7 de 10"). Las reglas de Higia cruzan el síntoma con los sensores y el contexto y deciden si hay que avisar.
- "minutosEjercicioRealizados" son los minutos que acaba de hacer (Higia los suma a los del día). "hidratacion" y "caloriasDia" son el total del día.
- emitir_alerta queda para lo que no tiene dato propio en la tabla (dolor de pecho, golpe, caída) o para lo urgente (no puede respirar, debilidad de un lado, desmayo): en ese caso usa la alerta y, si existe, también la lectura.
Tabla de datos (dato · unidad · rango · qué es):
${TABLA_SENSORES}

Acciones: eres el centro de la app y puedes controlarla. Si la frase lo pide, incluye en "acciones" lo que hay que hacer (si no, deja "acciones" vacía). Tu "respuesta" debe decir lo que hiciste.
- pedir_ayuda {destino, motivo}: el astronauta pide ayuda o describe una emergencia ("pide ayuda", "necesito a alguien", "me siento muy mal"). destino: "companero" | "medico" | "base" | "tierra" | "todos" (si no dice a quién, "todos"). Avisa de inmediato a otros y crea una alerta.
- enviar_mensaje {destino, mensaje}: quiere hablar con otro astronauta o mandar un mensaje que no es emergencia ("dile a Tierra que terminé la reparación", "avísale a Kai que voy para allá"). "mensaje" es lo que hay que transmitir, redactado en tercera persona si hace falta.
- emitir_alerta {nivel, sistema, titulo, detalle, region?}: cuenta un síntoma o un riesgo nuevo sin dato propio en la tabla, o algo urgente (dolor de pecho, no poder respirar, golpe, desmayo). nivel: "info" | "aviso" | "alerta" ("alerta" solo si es grave o urgente). sistema: "cerebro" | "ojos" | "oidoInterno" | "corazon" | "pulmones" | "inmune" | "intestino" | "huesos" | "musculos" | "piernas" | "metabolismo" | "cuerpo". region (opcional, dónde está el problema): "craneo" | "cara" | "cuello" | "torax" | "abdomen" | "columna" | "pelvis" | "brazos" | "piernas". Si es grave y además pide ayuda, usa también pedir_ayuda.
- chequeo_orientacion {}: Higia hace cuatro preguntas rápidas (nombre, lugar, mes, una resta) para medir la orientación. Úsalo ante confusión, desorientación o un golpe en la cabeza, o si lo pide. Si lo usas, NO hagas tú las preguntas: Higia agrega la primera al final de tu respuesta.
- confirmar_bien {}: dice que está bien en respuesta a una alerta que espera respuesta (ver <estado>.app.alertasEsperandoRespuesta).
- ir_a {seccion}: quiere ver una parte de la app. seccion: "asistente" | "resumen" | "mensajes" | "comunicaciones" | "perfil" (historia clínica) | "entorno" | "reportes".
- mostrar_sistema {sistema}: quiere ver un sistema del cuerpo en la figura.
- cambiar_contexto {ubicacion?, actividad?}: cuenta que cambió lo que hace ("salgo a EVA", "empiezo a entrenar"). ubicacion: "habitat" | "eva" | "rover"; actividad: "reposo" | "trabajo" | "ejercicio".
- voz {estado}: "silenciar" | "activar" | "detener".
- actualizar_historia {campo, valor}: cuenta un dato médico propio para su historia clínica ("soy alérgico al látex", "empecé a tomar…"). campo: "alergias" | "medicacion" | "antecedentes" | "notas".
- ejecutar_escenario {escenario} y cambiar_astronauta {astronauta}: solo si lo pide explícitamente para la demo; usa los id de <estado>.app.
Nunca inventes una emergencia: pedir_ayuda y emitir_alerta solo cuando la frase lo justifica.

Formato de salida: entrega la respuesta llamando a la herramienta "responder", con esta forma:
{"respuesta": "texto que se le dirá al astronauta", "lecturas": [{"sensor": "horasSueno", "valor": 5}], "acciones": [{"tipo": "pedir_ayuda", "destino": "todos", "motivo": "Dolor fuerte en el pecho"}]}
Valores permitidos para "sensor": ${SENSORES_CONVERSACION.map((s) => `"${s}"`).join(', ')}.`;

/** Acción del asistente. Esquema plano (más fácil para el modelo); la validación estricta la hace validarAcciones. */
const EsquemaAccion = z.object({
  tipo: z.string().describe('pedir_ayuda | enviar_mensaje | emitir_alerta | confirmar_bien | ir_a | mostrar_sistema | cambiar_contexto | voz | actualizar_historia | ejecutar_escenario | cambiar_astronauta'),
  destino: z.string().optional().describe('companero | medico | base | tierra | todos'),
  motivo: z.string().optional(),
  mensaje: z.string().optional(),
  nivel: z.string().optional().describe('info | aviso | alerta'),
  sistema: z.string().optional(),
  titulo: z.string().optional(),
  detalle: z.string().optional(),
  seccion: z.string().optional(),
  ubicacion: z.string().optional(),
  actividad: z.string().optional(),
  estado: z.string().optional().describe('silenciar | activar | detener'),
  campo: z.string().optional().describe('alergias | medicacion | antecedentes | notas'),
  region: z.string().optional().describe('craneo | cara | cuello | torax | abdomen | columna | pelvis | brazos | piernas'),
  valor: z.string().optional(),
  escenario: z.string().optional(),
  astronauta: z.string().optional(),
});

const EsquemaConversacion = z.object({
  respuesta: z.string(),
  lecturas: z.array(z.object({ sensor: z.enum(SENSORES_CONVERSACION), valor: z.number() })).default([]),
  acciones: z.array(EsquemaAccion).default([]),
});

export async function conversar(p: PeticionConversacion): Promise<RespuestaConversacion> {
  const historial: Mensaje[] = p.historial.slice(-12).map((t) => ({
    role: t.rol === 'astronauta' ? 'user' : 'assistant',
    content: t.texto,
  }));
  while (historial.length && historial[0].role !== 'user') historial.shift(); // la conversación debe empezar por el usuario

  const r = await pedirJSON([
    { role: 'system', content: SISTEMA_CONVERSACION },
    ...historial,
    { role: 'user', content: `<estado>\n${JSON.stringify(p.estado)}\n</estado>\n\n${p.frase}` },
  ], EsquemaConversacion, 'responder');
  // La app solo ejecuta acciones válidas: lo que el modelo invente o escriba mal se descarta.
  return { ...r, acciones: validarAcciones(r.acciones) };
}

// ── Evaluación de hallazgos ─────────────────────────────────────────────

const SISTEMA_EVALUACION = `Eres Higia, el sistema de monitoreo de salud de un hábitat espacial. El motor de reglas de Higia acaba de detectar un hallazgo y ya se lo comunicó al astronauta con un mensaje breve. Tu tarea es escribir una evaluación personalizada, en español, que complemente ese mensaje.

Cómo evaluar:
- Considera el hallazgo junto con el resto del estado que llega en <estado>: otros hallazgos, últimas lecturas, contexto (ubicación, actividad, destino, clima espacial, hora, si hay médico o compañero cerca) y perfil.
- El hallazgo trae "riesgosNASA": los riesgos del Human Research Program de la NASA a los que responde. Puedes nombrarlos si ayuda a entender por qué importa (por ejemplo "es uno de los riesgos que la NASA estudia para misiones largas").
- Considera la historia clínica previa (<estado>.perfil.historiaClinica): si un antecedente, una medicación o una alergia es relevante para este hallazgo, menciónalo. Nunca recomiendes algo a lo que es alérgico.
- Explica qué significa ahora y si se relaciona con otros hallazgos (por ejemplo, poco sueño y estrés alto). No diagnostiques enfermedades.
- No contradigas el nivel ni la acción de seguridad del motor; puedes concretarla según el contexto. No inventes cifras ni datos que no estén en <estado>.
- Adapta el lenguaje al perfil: sin formación médica, sin cifras ni tecnicismos; con formación médica, puedes dar cifras.
- Si el perfil es propenso al pánico o tiene baja tolerancia al estrés, o el hallazgo es sensible, usa un tono calmado y sin palabras alarmantes.
- "evaluacion": de una a tres oraciones. "recomendacion": una oración con el siguiente paso concreto. Sin markdown ni emojis.

Uso de datos (obligatorio):
- Basa la evaluación SOLO en los datos que recibes: <hallazgo>.datos (lo que usó el motor), <hallazgo>.series (la tendencia reciente de esos datos, con su antigüedad en minutos), <estado>.lecturasRecientes, <estado>.lineaBase y la historia clínica. No inventes valores, fechas ni estudios.
- En "datosUsados" enumera cada dato en que te apoyas, con su valor y unidad (por ejemplo "Impacto en la cabeza: 46 g, hace 2 min", "Ánimo 3/10 frente a línea base 7", "Antecedente: hipertensión arterial leve").
- En "limitaciones" di qué falta o qué limita la evaluación (por ejemplo "Solo hay una medición", "No hay chequeo de orientación después del golpe"). Si no falta nada relevante, deja "".
- Si los datos no alcanzan para concluir, dilo en la evaluación en lugar de suponer.

Formato de salida: entrega el resultado llamando a la herramienta "evaluar_hallazgo", con esta forma:
{"evaluacion": "...", "recomendacion": "...", "datosUsados": ["..."], "limitaciones": "..."}`;

const EsquemaEvaluacion = z.object({
  evaluacion: z.string().min(1),
  recomendacion: z.string(),
  datosUsados: z.array(z.string()).default([]),
  limitaciones: z.string().default(''),
});

export async function evaluarHallazgo(p: PeticionEvaluacion): Promise<EvaluacionIA> {
  return pedirJSON([
    { role: 'system', content: SISTEMA_EVALUACION },
    {
      role: 'user',
      content: `<estado>\n${JSON.stringify(p.estado)}\n</estado>\n\n<hallazgo>\n${JSON.stringify(p.hallazgo)}\n</hallazgo>\n\n<mensaje_enviado>\n${p.mensaje}\n</mensaje_enviado>`,
    },
  ], EsquemaEvaluacion, 'evaluar_hallazgo');
}

// ── Entorno por cámara ─────────────────────────────────────────────────

const SISTEMA_ENTORNO = `Eres el módulo de visión de Higia, un sistema de monitoreo de salud para hábitats espaciales.
Recibes una foto de la cámara del astronauta y el contexto que Higia cree actual. Tu trabajo es dar contexto, no diagnosticar.

- Describe en una o dos oraciones qué se ve que sea relevante para la seguridad o la salud.
- Infiere ubicación (hábitat, EVA, rover), destino (órbita, Luna, Marte) y actividad (reposo, trabajo, ejercicio) solo si la imagen lo muestra con claridad; si no, usa "desconocida"/"desconocido". Una foto de un interior terrestre corriente no indica destino.
- En "peligros", enumera riesgos visibles (persona caída, humo, sangre, equipo suelto, poca luz…). Lista vacía si no hay.
- En "recomendacion", una oración breve sobre qué debería tener en cuenta Higia. Escribe en español.

Formato de salida: entrega el resultado llamando a la herramienta "analizar_entorno", con esta forma:
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
  ], EsquemaEntorno, 'analizar_entorno');
}

/** Traduce los errores de la API a mensajes claros para la UI. */
export function traducirError(e: unknown): ErrorIA {
  if (e instanceof ErrorIA) return e;
  if (e instanceof ErrorAPI) {
    switch (e.status) {
      case 401: return new ErrorIA('Clave de API inválida. Revisa DEEPSEEK_API_KEY en app/.env o app/.env.local.', 401);
      case 402: return new ErrorIA('Saldo insuficiente en la cuenta de DeepSeek.', 402);
      case 429: return new ErrorIA('Límite de uso de la API alcanzado; intenta en un momento.', 429);
      case 400: case 422: return new ErrorIA(`Petición rechazada por la API: ${e.message}`, 400);
      default: return new ErrorIA(`Error de la API de IA (${e.status}).`, 502);
    }
  }
  if (!iaConfigurada()) return new ErrorIA('IA no configurada: agrega DEEPSEEK_API_KEY en app/.env o app/.env.local.', 503);
  return new ErrorIA(e instanceof Error ? e.message : 'Error desconocido en la IA.', 500);
}
