/**
 * MODO CONVERSACIONAL — interpreta frases en español (de voz o de texto).
 * Es un intérprete por palabras clave, liviano y sin conexión. Se puede ampliar con más intenciones.
 * Lo esencial para la seguridad (pedir ayuda, avisar a otros, reportar un síntoma, "estoy bien")
 * funciona aquí sin IA: la IA mejora la conversación, pero no es imprescindible para pedir ayuda.
 */
import type { Accion, DestinoPedido, SeccionApp } from './acciones';
import type { NucleoSalud } from './nucleo';
import { redactar } from './personalizador';
import { ORDEN_NIVEL, type Lectura, type TipoSensor } from './tipos';

export interface Respuesta {
  texto: string;
  /** Lecturas a registrar en el núcleo (si la frase era un registro). */
  lecturas: Lectura[];
  /** Acciones a ejecutar en la app (pedir ayuda, navegar, confirmar…). */
  acciones: Accion[];
}

const NUMEROS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, veinte: 20, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, noventa: 90,
};

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!]/g, '');

function numero(token: string): number | null {
  const n = parseFloat(token.replace(',', '.'));
  if (!Number.isNaN(n)) return n;
  return NUMEROS[token] ?? null;
}

const CONSULTAS: { claves: RegExp; riesgoId: string; nombre: string }[] = [
  { claves: /presion/, riesgoId: 'cardio.presion', nombre: 'presión arterial' },
  { claves: /pulso|ritmo|frecuencia|corazon/, riesgoId: 'cardio.frecuencia', nombre: 'frecuencia cardíaca' },
  { claves: /oxigeno|saturacion|respir/, riesgoId: 'pulmones.spo2', nombre: 'oxígeno' },
  { claves: /sueno|dormido|descans/, riesgoId: 'sueno.deficit', nombre: 'sueño' },
  { claves: /estres|nervio|ansie/, riesgoId: 'mental.estres', nombre: 'estrés' },
  { claves: /animo/, riesgoId: 'mental.animo', nombre: 'ánimo' },
  { claves: /ejercicio|entren/, riesgoId: 'musculo.ejercicio', nombre: 'ejercicio' },
  { claves: /radiacion|dosis/, riesgoId: 'radiacion.dosis', nombre: 'radiación' },
];

/** A quién se refiere una frase ("a Tierra", "al médico", "a Kai"…). */
function destinoEn(f: string, companeros: string[]): DestinoPedido | null {
  if (/\btierra\b|control de mision|houston/.test(f)) return 'tierra';
  if (/\bbase\b|habitat/.test(f)) return 'base';
  if (/medic|doctor/.test(f)) return 'medico';
  if (/companer|tripula|\bcolega/.test(f)) return 'companero';
  if (companeros.some((n) => f.includes(normalizar(n.split(' ')[0])))) return 'companero';
  if (/\btodos\b/.test(f)) return 'todos';
  return null;
}

const SECCION_POR_PALABRA: [RegExp, SeccionApp][] = [
  [/resumen|cuerpo|figura/, 'resumen'], [/mensaje|alerta|aviso/, 'mensajes'], [/comunicaci|contacto/, 'comunicaciones'],
  [/perfil|historia|clinic|ficha/, 'perfil'], [/entorno|camara|contexto/, 'entorno'], [/reporte/, 'reportes'], [/asistente|chat|conversa/, 'asistente'],
];

/** Síntomas que el astronauta puede contar y que Higia convierte en aviso o alerta. */
const SINTOMAS: { claves: RegExp; alerta: Extract<Accion, { tipo: 'emitir_alerta' }>; extra?: Accion[] }[] = [
  // Un golpe en la cabeza va antes que el golpe genérico: además de la alerta, Higia evalúa la orientación.
  {
    claves: /(golpe|golpee|pegue|di|darme) (fuerte )?(en |con )?(la )?cabeza|cabezazo|me (cai|desmaye) y me (golpee|pegue)/,
    alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'cerebro', titulo: 'Golpe en la cabeza (reportado)', detalle: 'El astronauta reporta un golpe en la cabeza.', region: 'craneo' },
    extra: [{ tipo: 'chequeo_orientacion' }],
  },
  { claves: /dolor (en el|de) pecho|duele (el|mucho el) pecho|opresion en el pecho/, alerta: { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'corazon', titulo: 'Dolor en el pecho', detalle: 'El astronauta reporta dolor u opresión en el pecho.', region: 'torax' } },
  { claves: /no puedo respirar|me falta el aire|me ahogo|falta de aire/, alerta: { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'pulmones', titulo: 'Dificultad para respirar', detalle: 'El astronauta reporta falta de aire.' } },
  { claves: /me voy a desmayar|me desmayo|perdi el conocimiento/, alerta: { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'cerebro', titulo: 'Sensación de desmayo', detalle: 'El astronauta reporta sensación de desmayo.' } },
  { claves: /mareo|mareado|mareada|vertigo|todo me da vueltas/, alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'oidoInterno', titulo: 'Mareo', detalle: 'El astronauta reporta mareo o vértigo.' } },
  { claves: /duele (la|mucho la) cabeza|dolor de cabeza|jaqueca|migrana/, alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'cerebro', titulo: 'Dolor de cabeza', detalle: 'El astronauta reporta dolor de cabeza.', region: 'craneo' } },
  { claves: /veo borroso|vision borrosa|no veo bien/, alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'ojos', titulo: 'Visión borrosa', detalle: 'El astronauta reporta visión borrosa.' } },
  { claves: /me (cai|golpee)|me lastime|me torci/, alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'huesos', titulo: 'Golpe o caída', detalle: 'El astronauta reporta un golpe o una caída.' } },
  { claves: /nauseas|ganas de vomitar|vomite/, alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'intestino', titulo: 'Náuseas', detalle: 'El astronauta reporta náuseas.' } },
];

/**
 * Señales de posible alteración de la percepción. No es un diagnóstico: cada señal suma al dato
 * "marcadoresPsicoticos" (0–10) que evalúa la regla, junto con el sueño y el estrés.
 */
const SENALES_PERCEPCION: RegExp[] = [
  /(oigo|escucho) voces|voces en mi cabeza|me hablan (las paredes|en mi cabeza|cuando no hay nadie)|alguien me habla y no hay nadie/,
  /(me|nos) (vigilan|persiguen|espian|quieren hacer dano)|alguien me (vigila|persigue|quiere hacer dano)|me estan (espiando|vigilando)|conspiran contra mi/,
  /veo (cosas|gente|personas|sombras) que (no|nadie)|hay alguien (aqui|en el modulo) que nadie ve|veo cosas raras/,
  /me controlan|controlan mis pensamientos|me meten pensamientos|leen mi mente|me roban los pensamientos/,
];

/** Pide o sugiere un chequeo de orientación. */
const PIDE_ORIENTACION = /chequeo de orientacion|prueba de orientacion|evalua (mi|la) orientacion|no se donde estoy|donde estoy|estoy (muy )?confundid[oa]|me siento confundid[oa]|no recuerdo (como llegue|que paso|nada)|me perdi/;

const NOMBRE_DESTINO_PEDIDO: Record<DestinoPedido, string> = {
  companero: 'tu compañero', medico: 'el equipo médico', base: 'la base', tierra: 'Tierra', todos: 'todos los que están al alcance',
};

export function interpretar(frase: string, nucleo: NucleoSalud, ahora = Date.now()): Respuesta {
  const f = normalizar(frase).replace(/[.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  const lectura = (sensor: TipoSensor, valor: number): Lectura => ({ sensor, valor, timestamp: ahora, fuente: 'voz' });
  const r = (texto: string, acciones: Accion[] = [], lecturas: Lectura[] = []): Respuesta => ({ texto, lecturas, acciones });

  // ── Emergencia: pedir ayuda (siempre primero) ──
  if (/\b(ayuda|ayudenme|auxilio|socorro|emergencia|mayday)\b/.test(f) && !/que (es|significa)/.test(f)) {
    const destino = destinoEn(f, nucleo.companeros) ?? 'todos';
    // Si además cuenta un síntoma ("me duele el pecho, pide ayuda"), queda también la alerta.
    const sintoma = SINTOMAS.find((s) => s.claves.test(f));
    return r(`Pido ayuda a ${NOMBRE_DESTINO_PEDIDO[destino]}. Quédate en un lugar seguro, sigo contigo.`,
      [{ tipo: 'pedir_ayuda', destino, motivo: `Pedido de voz: "${frase.trim()}"` }, ...(sintoma ? [sintoma.alerta] : [])]);
  }

  // ── Señales de alteración de la percepción: se registran como dato (la regla decide el nivel) ──
  const senales = SENALES_PERCEPCION.filter((re) => re.test(f)).length;
  if (senales) {
    return r('Gracias por contármelo. No estás solo: voy a pedir que alguien te acompañe. Busca un lugar tranquilo y quédate conmigo.',
      [], [lectura('marcadoresPsicoticos', Math.min(10, 4 + 2 * senales))]);
  }

  // ── Desorientación: chequeo de orientación ──
  if (PIDE_ORIENTACION.test(f)) {
    return r('Vamos a comprobarlo juntos, con calma.', [{ tipo: 'chequeo_orientacion' }]);
  }

  // ── Síntomas: generan un aviso o una alerta ──
  for (const s of SINTOMAS) {
    if (s.claves.test(f)) {
      if (s.extra) return r(`${s.alerta.titulo.replace(/ \(reportado\)$/, '')}: lo registro y vamos a revisar cómo estás.`, [s.alerta, ...s.extra]);
      const grave = s.alerta.nivel === 'alerta';
      return r(grave
        ? `${s.alerta.titulo}: lo registro como alerta. Detente y ponte en un lugar seguro. Si no respondes, aviso a otros.`
        : `${s.alerta.titulo}: lo registro como aviso y lo sigo de cerca. Avísame si empeora.`, [s.alerta]);
    }
  }

  // ── "Estoy bien" ──
  if (/estoy bien|me encuentro bien|todo bien|falsa alarma/.test(f)) {
    const n = nucleo.confirmacionesPendientes().size;
    return r(n ? 'Entendido, me alegra. Cancelo el aviso a otros.' : 'Me alegra. No hay alertas esperando respuesta.', [{ tipo: 'confirmar_bien' }]);
  }

  // ── Mensajes a otros: "dile a Tierra que…", "avísale a mi compañero que…" ──
  const msj = f.match(/(?:dile|digale|dile a|avisa|avisale|envia(?:le)?|manda(?:le)?|mensaje|comunica(?:le)?|llama)\b(.*)/);
  if (msj) {
    const destino = destinoEn(msj[1], nucleo.companeros);
    if (destino) {
      const contenido = frase.replace(/^.*?\b(que|:)\s*/i, '').trim();
      const mensaje = contenido && contenido !== frase.trim() ? contenido : `${nucleo.perfil.nombre} pide comunicarse.`;
      return r(`Listo, le envío el mensaje a ${NOMBRE_DESTINO_PEDIDO[destino]}.`, [{ tipo: 'enviar_mensaje', destino, mensaje }]);
    }
  }

  // ── Control de la app ──
  if (/silencia|callate|sin voz|silencio/.test(f)) return r('Silencio la voz.', [{ tipo: 'voz', estado: 'silenciar' }]);
  if (/activa la voz|habla de nuevo/.test(f)) return r('Vuelvo a hablar.', [{ tipo: 'voz', estado: 'activar' }]);
  if (/^(ve|ir|abre|abrir|muestra|muestrame|llevame|pasa|cambia)\b/.test(f)) {
    const destino = SECCION_POR_PALABRA.find(([re]) => re.test(f));
    if (destino) return r('Listo.', [{ tipo: 'ir_a', seccion: destino[1] }]);
  }
  if (/salgo a (una )?eva|voy a (salir|hacer una eva)/.test(f)) return r('Anotado: saliste a EVA. Ajusto los avisos.', [{ tipo: 'cambiar_contexto', ubicacion: 'eva', actividad: 'trabajo' }]);
  if (/volvi al habitat|estoy en el habitat|entre al habitat/.test(f)) return r('Bienvenido al hábitat.', [{ tipo: 'cambiar_contexto', ubicacion: 'habitat' }]);
  if (/(empiezo|voy) a (hacer )?(ejercicio|entrenar)/.test(f)) return r('Anotado: estás haciendo ejercicio.', [{ tipo: 'cambiar_contexto', actividad: 'ejercicio' }]);
  if (/(termine|deje) (el |de hacer )?(ejercicio|entrenar)|voy a descansar/.test(f)) return r('Anotado: en reposo.', [{ tipo: 'cambiar_contexto', actividad: 'reposo' }]);
  const alergia = f.match(/soy alergic[oa] a (?:la |el |los |las )?(.+)/);
  if (alergia) return r(`Anoto la alergia a ${alergia[1]} en tu historia clínica.`, [{ tipo: 'actualizar_historia', campo: 'alergias', valor: alergia[1] }]);

  // ── Registros ──
  let m = f.match(/dormi\s+(\S+)\s+horas?/);
  if (m && numero(m[1]) !== null) {
    const v = numero(m[1])!;
    return r(`Anotado: dormiste ${v} horas.`, [], [lectura('horasSueno', v)]);
  }
  m = f.match(/animo\s+(?:es\s+|de\s+|esta\s+en\s+|en\s+)?(\S+)/);
  if (m && numero(m[1]) !== null) {
    const v = Math.min(10, Math.max(1, numero(m[1])!));
    return r(`Anotado tu ánimo: ${v} de 10. Gracias por registrarlo.`, [], [lectura('animo', v)]);
  }
  m = f.match(/(?:hice|entrene)\s+(\S+)\s+minutos/);
  if (m && numero(m[1]) !== null) {
    const v = numero(m[1])!;
    const previo = nucleo.historial.ultima('minutosEjercicio');
    const mismoDia = previo && new Date(previo.timestamp).toDateString() === new Date(ahora).toDateString();
    const total = (mismoDia ? previo.valor : 0) + v;
    return r(`Anotado: ${v} minutos. Llevas ${total} hoy.`, [], [lectura('minutosEjercicio', total)]);
  }

  // ── Consultas ──
  if (/como estoy|resumen|estado general/.test(f)) {
    const problemas = nucleo.hallazgosActuales().filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso);
    if (!problemas.length) return r('Todo en orden. No hay avisos activos.');
    return r(`Hay ${problemas.length} punto(s) a atender: ${problemas.map((h) => h.titulo).join('; ')}.`);
  }
  for (const c of CONSULTAS) {
    if (c.claves.test(f)) {
      const h = nucleo.hallazgo(c.riesgoId);
      if (!h) return r(`Todavía no tengo datos de ${c.nombre}.`);
      return r(redactar(h, nucleo.perfil, nucleo.contexto));
    }
  }

  return r('No te entendí. Puedes preguntar «¿cómo está mi presión?», decir «dormí cinco horas» o «pide ayuda».');
}
