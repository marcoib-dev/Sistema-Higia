/**
 * MODO CONVERSACIONAL — interpreta frases en español (de voz o de texto).
 * Es un intérprete por palabras clave, liviano y sin conexión. Se puede ampliar con más intenciones.
 * Lo esencial para la seguridad (pedir ayuda, avisar a otros, reportar un síntoma, "estoy bien")
 * funciona aquí sin IA: la IA mejora la conversación, pero no es imprescindible para pedir ayuda.
 */
import type { Accion, DestinoPedido, SeccionApp } from './acciones';
import type { NucleoSalud } from './nucleo';
import { palabrasANumeros } from './numeros';
import { redactar } from './personalizador';
import { enRango, INFO_SENSOR, ORDEN_NIVEL, type Lectura, type TipoSensor } from './tipos';

export interface Respuesta {
  texto: string;
  /** Lecturas a registrar en el núcleo (si la frase era un registro). */
  lecturas: Lectura[];
  /** Acciones a ejecutar en la app (pedir ayuda, navegar, confirmar…). */
  acciones: Accion[];
}

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!]/g, '');

/** Un número en cifras (los números en palabras ya se convirtieron con `palabrasANumeros`). */
const NUM = String.raw`(\d+(?:\.\d+)?)`;

const CONSULTAS: { claves: RegExp; riesgoId: string; nombre: string }[] = [
  { claves: /presion/, riesgoId: 'cardio.presion', nombre: 'presión arterial' },
  { claves: /pulso|ritmo|frecuencia|corazon/, riesgoId: 'cardio.frecuencia', nombre: 'frecuencia cardíaca' },
  { claves: /oxigeno|saturacion|respir/, riesgoId: 'pulmones.spo2', nombre: 'oxígeno' },
  { claves: /sueno|dormido|descans/, riesgoId: 'sueno.deficit', nombre: 'sueño' },
  { claves: /estres|nervio|ansie/, riesgoId: 'mental.estres', nombre: 'estrés' },
  { claves: /animo/, riesgoId: 'mental.animo', nombre: 'ánimo' },
  { claves: /ejercicio|entren/, riesgoId: 'musculo.ejercicio', nombre: 'ejercicio' },
  { claves: /radiacion|dosis/, riesgoId: 'radiacion.dosis', nombre: 'radiación' },
  { claves: /temperatura|fiebre/, riesgoId: 'inmune.fiebre', nombre: 'temperatura' },
  { claves: /glucemia|glucosa|azucar/, riesgoId: 'metabolismo.glucemia', nombre: 'glucemia' },
  { claves: /vision|\bojos?\b|\bvista\b/, riesgoId: 'sans.vision', nombre: 'visión' },
  { claves: /hueso/, riesgoId: 'hueso.perdida', nombre: 'huesos' },
  { claves: /fuerza|musculo/, riesgoId: 'musculo.aptitud', nombre: 'fuerza' },
  { claves: /\bpeso\b|nutricion|comida|calorias/, riesgoId: 'nutricion.peso', nombre: 'peso y nutrición' },
  { claves: /equilibrio/, riesgoId: 'vestibular.equilibrio', nombre: 'equilibrio' },
  { claves: /pierna|pantorrilla|coagulo/, riesgoId: 'vascular.trombosis', nombre: 'piernas y circulación' },
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

/**
 * Lo urgente, que no depende de ninguna regla: alerta inmediata (camino de seguridad, sin red ni IA).
 * Si el síntoma tiene un dato propio, además se registra la lectura para que las reglas lo crucen.
 */
const URGENTES: { claves: RegExp; alerta: Extract<Accion, { tipo: 'emitir_alerta' }>; lectura?: [TipoSensor, number]; extra?: Accion[] }[] = [
  // Un golpe en la cabeza va antes que el golpe genérico: además de la alerta, Higia evalúa la orientación.
  {
    claves: /(golpe|golpee|pegue|di|darme) (fuerte )?(en |con )?(la )?cabeza|cabezazo|me (cai|desmaye) y me (golpee|pegue)/,
    alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'cerebro', titulo: 'Golpe en la cabeza (reportado)', detalle: 'El astronauta reporta un golpe en la cabeza.', region: 'craneo' },
    extra: [{ tipo: 'chequeo_orientacion' }],
  },
  { claves: /dolor (en el|de) pecho|duele (el|mucho el) pecho|opresion en el pecho/, alerta: { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'corazon', titulo: 'Dolor en el pecho', detalle: 'El astronauta reporta dolor u opresión en el pecho.', region: 'torax' } },
  { claves: /no puedo respirar|me ahogo|me asfixio/, alerta: { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'pulmones', titulo: 'Dificultad para respirar', detalle: 'El astronauta reporta que no puede respirar.', region: 'torax' }, lectura: ['sxDisnea', 9] },
  { claves: /me voy a desmayar|me desmayo|perdi el conocimiento/, alerta: { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'cerebro', titulo: 'Sensación de desmayo', detalle: 'El astronauta reporta sensación de desmayo.' } },
  // Signos de ACV: alerta siempre, esté o no en la ventana de la EVA.
  { claves: /no puedo mover (el|la|un|una|mi)|me cuesta hablar|no puedo hablar bien|se me cae (la cara|un lado)|debilidad (de|en) un lado/, alerta: { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'cerebro', titulo: 'Debilidad o dificultad para hablar', detalle: 'El astronauta reporta debilidad de un lado o dificultad para hablar.', region: 'craneo' }, lectura: ['sxNeurologico', 8] },
  { claves: /me (cai|golpee)|me lastime|me torci/, alerta: { tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'huesos', titulo: 'Golpe o caída', detalle: 'El astronauta reporta un golpe o una caída.' } },
];

/** Síntomas que se registran como dato (intensidad 0–10): las reglas los cruzan con sensores y contexto. */
const SINTOMAS: { claves: RegExp; sensor: TipoSensor }[] = [
  { claves: /duele.{0,20}cabeza|dolor de cabeza|jaqueca|migrana|cefalea/, sensor: 'sxCefalea' },
  { claves: /mareo|mareado|mareada|vertigo|todo me da vueltas|desorientad[oa] en el espacio/, sensor: 'sxMareo' },
  { claves: /nauseas|ganas de vomitar|vomite|vomito/, sensor: 'sxNauseas' },
  { claves: /veo borroso|vision borrosa|no veo bien|veo doble|cambios? (en la|de) vision/, sensor: 'sxVision' },
  { claves: /me falta (el|un poco el|algo de) aire|falta de aire|me cuesta respirar|me agito/, sensor: 'sxDisnea' },
  { claves: /duelen?.{0,20}(hombros?|codos?|rodillas?|articulacion(es)?)|dolor (de|en) (las? |el |los )?(articulaciones|hombros?|codos?|rodillas?)/, sensor: 'sxDolorArticular' },
  { claves: /hormigueo|se me duerme|adormecid[oa]|cosquilleo/, sensor: 'sxNeurologico' },
  { claves: /erupcion|sarpullido|herpes|ampolla en el labio|me salio una ampolla|ronchas|lesion en la piel/, sensor: 'sxPiel' },
  { claves: /alergia|estornud|picazon|me pica|congestion/, sensor: 'sxAlergia' },
  { claves: /diarrea|dolor de (panza|estomago|barriga)|duele (la panza|el estomago)|retortijones/, sensor: 'sxDigestivo' },
  { claves: /dolor de espalda|duele.{0,20}espalda|lumbar|columna/, sensor: 'sxDolorEspalda' },
  { claves: /(duele|dolor (en|de)|hinchad[ao]|hinchazon (en|de)) (la |una |mi )?(pierna|pantorrilla)|(pierna|pantorrilla) hinchad[ao]/, sensor: 'sxDolorPierna' },
  { claves: /no tengo hambre|sin apetito|perdi el apetito|la comida me aburre|no me dan ganas de comer/, sensor: 'sxApetito' },
];

/** Intensidad de un síntoma según cómo lo cuenta: "un poco" → 3, "mucho" → 8, "7 de 10" → 7. */
function intensidad(f: string): number {
  const escala = f.match(/\b(\d+(?:\.\d+)?) de 10\b/);
  if (escala) return enRango('sxCefalea', Number(escala[1]));
  if (/\b(insoportable|muy fuerte|fuertisim[oa]|muchisim[oa]|terrible|intens[oa]|fuerte|mucho|mucha)\b/.test(f)) return 8;
  if (/\b(leve|un poco|algo|poquito|ligero|ligera|apenas)\b/.test(f)) return 3;
  return 5;
}

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
  // Se conservan los decimales ("38,2") y los números en palabras pasan a cifras.
  const f = palabrasANumeros(normalizar(frase).replace(/(?<!\d)[.,;:]|[.,;:](?!\d)/g, ' ').replace(/\s+/g, ' ').trim());
  const lectura = (sensor: TipoSensor, valor: number): Lectura => ({ sensor, valor: enRango(sensor, valor), timestamp: ahora, fuente: 'voz' });
  /** Total del día: suma a lo ya registrado hoy, salvo que diga "llevo" (ya es el total). */
  const delDia = (sensor: TipoSensor, v: number, total: boolean) => {
    const previo = nucleo.historial.ultima(sensor);
    const mismoDia = previo && new Date(previo.timestamp).toDateString() === new Date(ahora).toDateString();
    return total || !mismoDia ? v : previo.valor + v;
  };
  const r = (texto: string, acciones: Accion[] = [], lecturas: Lectura[] = []): Respuesta => ({ texto, lecturas, acciones });

  // ── Emergencia: pedir ayuda (siempre primero) ──
  if (/\b(ayuda|ayudenme|auxilio|socorro|emergencia|mayday)\b/.test(f) && !/que (es|significa)/.test(f)) {
    const destino = destinoEn(f, nucleo.companeros) ?? 'todos';
    // Si además cuenta un síntoma ("me duele el pecho, pide ayuda"), queda también la alerta.
    const sintoma = URGENTES.find((s) => s.claves.test(f));
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

  // ── Lo urgente: alerta inmediata ──
  const urgente = URGENTES.find((s) => s.claves.test(f));
  if (urgente) {
    const lecturas = urgente.lectura ? [lectura(urgente.lectura[0], urgente.lectura[1])] : [];
    if (urgente.extra) return r(`${urgente.alerta.titulo.replace(/ \(reportado\)$/, '')}: lo registro y vamos a revisar cómo estás.`, [urgente.alerta, ...urgente.extra], lecturas);
    const grave = urgente.alerta.nivel === 'alerta';
    return r(grave
      ? `${urgente.alerta.titulo}: lo registro como alerta. Detente y ponte en un lugar seguro. Si no respondes, aviso a otros.`
      : `${urgente.alerta.titulo}: lo registro como aviso y lo sigo de cerca. Avísame si empeora.`, [urgente.alerta], lecturas);
  }

  // ── Síntomas: se registran como dato; las reglas deciden si hay que avisar ──
  const contados = SINTOMAS.filter((s) => s.claves.test(f));
  if (contados.length) {
    const v = intensidad(f);
    const sensores = [...new Set(contados.map((s) => s.sensor))];
    const nombres = sensores.map((s) => INFO_SENSOR[s].nombre.toLowerCase());
    return r(`Lo registro: ${nombres.join(', ')} (intensidad ${v} de 10). Lo cruzo con tus otros datos y te aviso si hace falta hacer algo. Cuéntame si empeora.`,
      [], sensores.map((s) => lectura(s, v)));
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
  // ── Control del simulador (demo) ──
  if (/simulador|escenario|demo/.test(f)) {
    const orden = /pausa|deten un momento|espera/.test(f) ? 'pausar'
      : /siguiente|proximo paso|avanza/.test(f) ? 'siguiente'
      : /continua|reanuda|sigue/.test(f) ? 'continuar'
      : /reinicia|de nuevo|desde el principio/.test(f) ? 'reiniciar'
      : /deten|para|termina|cierra/.test(f) ? 'detener' : null;
    if (orden) return r('Listo.', [{ tipo: 'control_simulador', orden }]);
  }

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
  let m = f.match(new RegExp(`dormi\\s+${NUM}\\s+horas?`));
  if (m) {
    const v = Number(m[1]);
    return r(`Anotado: dormiste ${v} horas.`, [], [lectura('horasSueno', v)]);
  }
  m = f.match(new RegExp(`animo\\s+(?:es\\s+|de\\s+|esta\\s+en\\s+|en\\s+)?${NUM}`));
  if (m) {
    const v = enRango('animo', Number(m[1]));
    return r(`Anotado tu ánimo: ${v} de 10. Gracias por registrarlo.`, [], [lectura('animo', v)]);
  }
  m = f.match(new RegExp(`(?:hice|entrene)\\s+${NUM}\\s+minutos`));
  if (m) {
    const v = Number(m[1]);
    const total = delDia('minutosEjercicio', v, false);
    return r(`Anotado: ${v} minutos. Llevas ${total} hoy.`, [], [lectura('minutosEjercicio', total)]);
  }
  m = f.match(new RegExp(`presion\\D{0,20}?${NUM}\\s*(?:sobre|/|con)\\s*${NUM}`));
  if (m) {
    const [sis, dia] = [Number(m[1]), Number(m[2])];
    return r(`Anotado: presión ${sis} sobre ${dia}.`, [], [lectura('presionSistolica', sis), lectura('presionDiastolica', dia)]);
  }
  m = f.match(new RegExp(`(?:temperatura|fiebre)\\D{0,15}?${NUM}`)) ?? f.match(new RegExp(`${NUM}\\s*(?:grados|de fiebre)`));
  if (m && Number(m[1]) >= 30 && Number(m[1]) <= 45) {
    const v = Number(m[1]);
    return r(`Anotado: temperatura de ${v} grados.`, [], [lectura('temperatura', v)]);
  }
  m = f.match(new RegExp(`(?:glucemia|glucosa|azucar)\\D{0,15}?${NUM}`));
  if (m) {
    const v = Number(m[1]);
    return r(`Anotado: glucemia de ${v}.`, [], [lectura('glucemia', v)]);
  }
  m = f.match(new RegExp(`(?:peso|pese)\\D{0,10}?${NUM}`));
  if (m) {
    const v = Number(m[1]);
    return r(`Anotado: ${v} kilos.`, [], [lectura('pesoCorporal', v)]);
  }
  m = f.match(new RegExp(`(tome|bebi|llevo)\\s+${NUM}\\s*(litros?|l|ml|mililitros|vasos?)\\s+(?:de\\s+)?agua`));
  if (m) {
    const factor = /^l/.test(m[3]) && m[3] !== 'ml' ? 1000 : /^vaso/.test(m[3]) ? 250 : 1;
    const ml = Math.round(Number(m[2]) * factor);
    const total = delDia('hidratacion', ml, m[1] === 'llevo');
    return r(`Anotado: llevas ${total} mililitros de agua hoy.`, [], [lectura('hidratacion', total)]);
  }
  m = f.match(new RegExp(`(comi|consumi|llevo)\\s+${NUM}\\s*(?:calorias|kcal)`));
  if (m) {
    const total = delDia('caloriasDia', Number(m[2]), m[1] === 'llevo');
    return r(`Anotado: llevas ${total} calorías hoy.`, [], [lectura('caloriasDia', total)]);
  }
  m = f.match(new RegExp(`trabaje\\s+${NUM}\\s*horas?`));
  if (m) {
    const v = Number(m[1]);
    return r(`Anotado: ${v} horas de trabajo hoy.${v > 10 ? ' Es una jornada larga: reserva un rato para descansar.' : ''}`, [], [lectura('horasTrabajo', v)]);
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
