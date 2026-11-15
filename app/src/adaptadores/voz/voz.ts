/**
 * ADAPTADOR DE VOZ — Web Speech API del navegador.
 * - Síntesis (hablar): voz neuronal local (Piper, sin conexión) y, de respaldo, las voces del sistema. Se puede pausar, detener y ajustar el volumen.
 * - Reconocimiento (escuchar): en Chrome usa servidores de Google, así que NO es autónomo.
 *   TODO (línea D): reemplazar por un motor local (p. ej. Vosk o whisper.cpp) para la versión final.
 */

import { estadoPiper, sintetizar } from './piper';

let volumen = 1;

export function sintesisDisponible(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Qué voz está hablando: la neuronal local (Piper) o la del navegador (respaldo). */
export function motorSintesis(): 'neuronal' | 'navegador' | 'cargando' {
  const e = estadoPiper();
  return e === 'lista' ? 'neuronal' : e === 'error' ? 'navegador' : 'cargando';
}

/** Volumen de 0 a 1. Con la voz neuronal se aplica también a lo que está sonando. */
export function fijarVolumen(v: number): void {
  volumen = Math.min(1, Math.max(0, v));
  if (actual?.audio) actual.audio.volume = volumen;
}

// ── Voz neuronal: cola propia (genera el audio del siguiente mientras suena el actual) ──
interface Pendiente { texto: string; alTerminar?: () => void; wav: Promise<Blob> }
const cola: Pendiente[] = [];
let actual: { p: Pendiente; audio?: HTMLAudioElement; url?: string } | null = null;
let pausada = false;
/** Cambia al detener: lo que se estaba generando para la cola anterior se descarta. */
let generacion = 0;
/** La inferencia es de a una: cada texto espera al anterior. */
let ultimaSintesis: Promise<unknown> = Promise.resolve();

/**
 * Parte el texto en oraciones: la primera empieza a sonar enseguida y las siguientes se generan
 * mientras tanto, así la demora inicial es la de una oración. Los fragmentos muy cortos ("Sí.")
 * se pegan al anterior para no cortar la entonación.
 */
export function partirEnOraciones(texto: string, minimo = 20): string[] {
  const partes = texto.match(/[^.!?…:;]+[.!?…:;]*\s*/g)?.map((x) => x.trim()).filter(Boolean) ?? [texto.trim()];
  const salida: string[] = [];
  for (const parte of partes) {
    if (salida.length && parte.length < minimo) salida[salida.length - 1] += ` ${parte}`;
    else salida.push(parte);
  }
  return salida;
}

function encolarNeuronal(texto: string, alTerminar?: () => void): void {
  const oraciones = partirEnOraciones(texto);
  oraciones.forEach((o, i) => {
    const wav = ultimaSintesis.then(() => sintetizar(o));
    ultimaSintesis = wav.catch(() => undefined);
    // Quien espera el final se entera con la última oración.
    cola.push({ texto: o, alTerminar: i === oraciones.length - 1 ? alTerminar : undefined, wav });
  });
  if (!actual) siguiente();
}

function siguiente(): void {
  const p = cola.shift();
  if (!p) { actual = null; return; }
  const g = generacion;
  actual = { p };
  const terminar = () => {
    if (g !== generacion) return;
    if (actual?.url) URL.revokeObjectURL(actual.url);
    actual = null;
    p.alTerminar?.();
    siguiente();
  };
  p.wav.then((blob) => {
    if (g !== generacion) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = volumen;
    audio.onended = terminar;
    audio.onerror = terminar;
    actual = { p, audio, url };
    if (!pausada) audio.play().catch(terminar);
  }, () => {
    // Si la voz neuronal falla con este texto, lo dice la del navegador: el mensaje nunca se pierde.
    if (g !== generacion) return;
    hablarNavegador(p.texto, terminar);
  });
}

function hablarNavegador(texto: string, alTerminar?: () => void): void {
  if (!sintesisDisponible()) { alTerminar?.(); return; }
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-ES';
  u.volume = volumen;
  if (alTerminar) {
    u.onend = () => alTerminar();
    u.onerror = () => alTerminar();
  }
  window.speechSynthesis.speak(u);
}

export function hablar(texto: string, alTerminar?: () => void): void {
  if (volumen === 0 || !texto.trim()) {
    alTerminar?.();
    return;
  }
  if (estadoPiper() === 'lista') encolarNeuronal(texto, alTerminar);
  else hablarNavegador(texto, alTerminar);
}

export function pausar(): void {
  pausada = true;
  actual?.audio?.pause();
  if (sintesisDisponible()) window.speechSynthesis.pause();
}

export function reanudar(): void {
  pausada = false;
  void actual?.audio?.play().catch(() => undefined);
  if (sintesisDisponible()) window.speechSynthesis.resume();
}

/** Corta lo que está diciendo y vacía la cola. */
export function detener(): void {
  generacion++;
  const avisar = [actual?.p, ...cola].filter((x): x is Pendiente => !!x);
  if (actual?.audio) actual.audio.pause();
  if (actual?.url) URL.revokeObjectURL(actual.url);
  actual = null;
  cola.length = 0;
  pausada = false;
  // Como la voz del navegador al cancelar: quien esperaba el final se entera.
  avisar.forEach((x) => x.alTerminar?.());
  if (sintesisDisponible()) window.speechSynthesis.cancel();
}

export function estadoVoz(): 'hablando' | 'pausada' | 'callada' {
  if (actual || cola.length) return pausada ? 'pausada' : 'hablando';
  if (!sintesisDisponible()) return 'callada';
  const s = window.speechSynthesis;
  if (s.paused && (s.speaking || s.pending)) return 'pausada';
  return s.speaking || s.pending ? 'hablando' : 'callada';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReconocedorCtor = new () => any;

function ctorReconocimiento(): ReconocedorCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: ReconocedorCtor; webkitSpeechRecognition?: ReconocedorCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function reconocimientoDisponible(): boolean {
  return !!ctorReconocimiento();
}

/**
 * Por qué el reconocimiento no puede funcionar en este navegador, si se sabe de antemano.
 * Devuelve undefined cuando hay una oportunidad real de que funcione.
 */
export function diagnosticoReconocimiento(d: { disponible: boolean; seguro: boolean; agente: string; brave?: boolean }): string | undefined {
  if (!d.disponible) {
    return d.seguro
      ? 'Este navegador no tiene reconocimiento de voz. Usa Google Chrome o Microsoft Edge, o escribe el mensaje.'
      : 'El micrófono y el reconocimiento de voz solo funcionan en HTTPS o en localhost. Abre la app en http://localhost:5173.';
  }
  // Brave expone la API, pero bloquea el servicio de Google y nunca entrega transcripciones.
  if (d.brave || /Brave\//i.test(d.agente)) {
    return 'Brave bloquea el servicio de reconocimiento de voz: la API existe pero no devuelve texto. Abre Higia en Google Chrome o Microsoft Edge, o escribe el mensaje.';
  }
  return undefined;
}

export function motivoSinReconocimiento(): string | undefined {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return undefined;
  return diagnosticoReconocimiento({
    disponible: reconocimientoDisponible(),
    seguro: window.isSecureContext !== false,
    agente: navigator.userAgent,
    brave: !!(navigator as unknown as { brave?: unknown }).brave,
  });
}

/** Mensaje entendible para los errores que informa el reconocedor del navegador. */
export function mensajeErrorReconocimiento(tipo: string): string {
  switch (tipo) {
    case 'not-allowed':
      return 'Permiso de micrófono denegado: permite el micrófono en el candado de la barra de direcciones y vuelve a intentarlo.';
    case 'service-not-allowed':
      return 'El navegador no permite el servicio de reconocimiento de voz. Usa Google Chrome o Microsoft Edge.';
    case 'audio-capture':
      return 'No se encontró un micrófono. Conecta uno y vuelve a intentarlo.';
    case 'network':
      return 'Sin conexión con el servicio de voz del navegador. En Brave o en Chromium sin los servicios de Google no funciona: usa Chrome o Edge.';
    case 'language-not-supported':
      return 'El reconocimiento de voz del navegador no admite español.';
    case 'aborted':
      return 'La escucha se interrumpió.';
    default:
      return `El reconocimiento de voz falló (${tipo}).`;
  }
}

// ── Palabra clave «Higia» ──────────────────────────────────────────────

const normalizarVoz = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Formas en que el reconocedor suele escribir «Higia» (Higía, Igia, Hijia, Hygeia, «y gía»…).
 * Vosk en español la transcribe a menudo como «guía»; se acepta al principio de la frase para no
 * activarse cuando el nombre aparece en medio de otra conversación.
 */
const LLAMADO = /^(?:(?:oye|hola|ey|hey|ok|okey|eh)[\s,]+)?(?:y\s+)?(?:h?i\s*[gj]i?ia|hygeia|higea|higuia|higa|guia|jia|lijia)\b[\s,.:!?]*/;

/** ¿La frase empieza llamando a Higia? Devuelve el resto (el pedido), sin el nombre. */
export function detectarLlamado(texto: string): { llamado: boolean; resto: string } {
  const original = texto.trim().normalize('NFC');
  const m = normalizarVoz(original).match(LLAMADO);
  if (!m) return { llamado: false, resto: original };
  // Se recorta el original (con sus tildes) avanzando letra por letra hasta cubrir lo que coincidió.
  let consumido = 0;
  let i = 0;
  while (i < original.length && consumido < m[0].length) consumido += normalizarVoz(original[i++]).length;
  return { llamado: true, resto: original.slice(i).trim() };
}

export type EstadoEscucha = 'apagada' | 'cargando' | 'esperando' | 'llamado' | 'error';

interface OpcionesEscucha {
  /** Pedido completo después de «Higia» (o la frase siguiente, si solo dijo «Higia»). */
  onComando: (texto: string) => void;
  onEstado: (e: EstadoEscucha, detalle?: string) => void;
  /** Mientras devuelva true, lo que se oye se ignora (p. ej. mientras Higia habla, para no escucharse a sí misma). */
  ignorar: () => boolean;
  /** Motor de reconocimiento; por defecto, el nativo del navegador. */
  motor?: MotorVoz;
}

/** Tras decir solo «Higia», cuánto tiempo se espera el pedido. */
const ESPERA_PEDIDO_MS = 8000;

/** Hasta cuándo se acepta una respuesta sin nombrar a Higia (cuando ella acaba de hacer una pregunta). */
let respuestaHasta = 0;

/** La ventana de escucha sin nombre está activa en este instante. */
export function respuestaSinNombreActiva(now: number = Date.now()): boolean {
  return now < respuestaHasta;
}

/** Higia hizo una pregunta o acaba de responder: se acepta otra frase sin nombrarla durante unos segundos. */
export function aceptarRespuestaSinNombre(ms: number): void {
  respuestaHasta = Date.now() + ms;
}

export type MotorVoz = 'local' | 'navegador' | 'ninguno';

/** ¿Este navegador puede ejecutar el motor local (Vosk/WASM + micrófono + contexto seguro)? */
export function soporteVozLocal(): boolean {
  return typeof window !== 'undefined'
    && typeof AudioContext !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && window.isSecureContext !== false;
}

/** Brave expone la API nativa pero no transcribe; con Vosk sí puede usar el micrófono. */
export function esBrave(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Brave\//i.test(navigator.userAgent) || !!(navigator as unknown as { brave?: unknown }).brave;
}

/** Chromium de las distribuciones tampoco trae las claves del servicio de voz de Google. */
export function esChromiumSinVoz(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Chromium\//i.test(navigator.userAgent) && !/\bChrome\//i.test(navigator.userAgent);
}

/**
 * Elige el motor de reconocimiento:
 * - `VITE_VOSK_MOTOR=local` o `VITE_VOSK_MODELO` definido → Vosk local.
 * - `VITE_VOSK_MOTOR=navegador` → Web Speech del navegador si existe.
 * - Automático: Vosk en Brave/Firefox o cuando no hay API nativa; nativo en Chrome/Edge.
 */
export function motorVozPreferido(): MotorVoz {
  const localPosible = soporteVozLocal();
  const nativo = reconocimientoDisponible();
  const elegido = (import.meta.env.VITE_VOSK_MOTOR as string | undefined)?.trim().toLowerCase();
  if (elegido === 'navegador') return nativo ? 'navegador' : localPosible ? 'local' : 'ninguno';
  const forzarLocal = elegido === 'local' || !!import.meta.env.VITE_VOSK_MODELO;
  if (forzarLocal && localPosible) return 'local';
  if (!nativo) return localPosible ? 'local' : 'ninguno';
  if (localPosible && (esBrave() || esChromiumSinVoz())) return 'local';
  return 'navegador';
}

interface Detector {
  /** Procesa una frase final (con sus alternativas, si el motor las ofrece). */
  alTexto(alternativas: string[]): void;
  /** El motor arrancó: publica «esperando» o «llamado» según la ventana actual. */
  alIniciar(): void;
  parar(): void;
}

/** Máquina de estados de «Higia»: llamado, espera de 8 s y respuestas sin nombrarla. */
function crearDetector({ onComando, onEstado }: Pick<OpcionesEscucha, 'onComando' | 'onEstado'>): Detector {
  let esperaHasta = 0;
  let esperaPedido: ReturnType<typeof setTimeout> | undefined;
  const limpiar = () => {
    clearTimeout(esperaPedido);
    esperaPedido = undefined;
    esperaHasta = 0;
  };
  const esperar = () => {
    esperaHasta = Date.now() + ESPERA_PEDIDO_MS;
    clearTimeout(esperaPedido);
    esperaPedido = setTimeout(() => { esperaHasta = 0; onEstado('esperando'); }, ESPERA_PEDIDO_MS);
    onEstado('llamado');
  };
  return {
    alTexto(alternativas) {
      const conLlamado = alternativas.map(detectarLlamado).find((d) => d.llamado);
      if (conLlamado) {
        if (conLlamado.resto) {
          limpiar();
          onEstado('esperando');
          onComando(conLlamado.resto);
        } else {
          esperar();
        }
      } else if (Date.now() < esperaHasta || respuestaSinNombreActiva()) {
        limpiar();
        respuestaHasta = 0;
        onEstado('esperando');
        const texto = alternativas[0]?.trim();
        if (texto) onComando(texto);
      }
    },
    alIniciar() { onEstado(Date.now() < esperaHasta || respuestaSinNombreActiva() ? 'llamado' : 'esperando'); },
    parar: limpiar,
  };
}

/** Motor nativo del navegador: continuo, con reinicio automático y errores explicados. */
function escucharConNavegador(detector: Detector, onEstado: OpcionesEscucha['onEstado'], ignorar: () => boolean): () => void {
  const Ctor = ctorReconocimiento();
  if (!Ctor) {
    onEstado('error', motivoSinReconocimiento() ?? 'Este navegador no tiene reconocimiento de voz (usa Chrome o Edge).');
    return () => {};
  }
  /** Fallos de red seguidos antes de rendirse: Brave y Chromium sin servicios de Google fallan siempre. */
  const MAX_FALLOS_RED = 3;
  let activa = true;
  let reintento: ReturnType<typeof setTimeout> | undefined;
  let fallosRed = 0;
  let fallosInicio = 0;
  let r: InstanceType<ReconocedorCtor> | null = null;

  const terminarConError = (mensaje: string) => {
    activa = false;
    clearTimeout(reintento);
    detector.parar();
    onEstado('error', mensaje);
    try { r?.abort(); } catch { /* ya detenido */ }
  };

  const iniciar = () => {
    if (!activa) return;
    r = new Ctor();
    r.lang = 'es-ES';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.onresult = (e: { resultIndex: number; results: { isFinal: boolean; length: number; [i: number]: { transcript: string } }[] }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res.isFinal) continue;
        fallosRed = 0; // el servicio responde: no es un fallo de conexión
        if (ignorar()) continue;
        // Entre las alternativas, la que contenga el llamado (el reconocedor a veces lo escribe distinto).
        const alternativas = Array.from({ length: res.length }, (_, k) => res[k].transcript);
        detector.alTexto(alternativas);
      }
    };
    r.onerror = (e: { error: string }) => {
      if (!activa) return;
      if (e.error === 'network') {
        // Brave, Chromium sin los servicios de Google o falta de internet: no se puede transcribir.
        fallosRed += 1;
        if (fallosRed >= MAX_FALLOS_RED) terminarConError(mensajeErrorReconocimiento('network'));
        return;
      }
      // no-speech y aborted son parte del uso normal: onend reinicia.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      terminarConError(mensajeErrorReconocimiento(e.error));
    };
    r.onend = () => {
      if (!activa) return;
      clearTimeout(reintento);
      // Tras un fallo de red se espera más para no golpear el servicio en un bucle.
      reintento = setTimeout(iniciar, fallosRed > 0 ? 1500 : 400);
    };
    try {
      r.start();
      fallosInicio = 0;
      detector.alIniciar();
    } catch {
      if (!activa) return;
      fallosInicio += 1;
      if (fallosInicio >= 3) terminarConError('No se pudo iniciar el micrófono. Cierra otras pestañas o aplicaciones que lo estén usando y vuelve a activar la escucha.');
      else reintento = setTimeout(iniciar, 1000);
    }
  };

  iniciar();
  return () => {
    activa = false;
    clearTimeout(reintento);
    detector.parar();
    try { r?.abort(); } catch { /* ya detenido */ }
    onEstado('apagada');
  };
}

/** Motor local (Vosk): se carga en segundo plano y transcribe en el dispositivo. */
function escucharConLocal(detector: Detector, onEstado: OpcionesEscucha['onEstado'], ignorar: () => boolean): () => void {
  let cancelado = false;
  let detener: (() => void) | undefined;
  onEstado('cargando');
  void import('./motorLocal').then(({ crearEscuchaLocal }) => {
    if (cancelado) return;
    detener = crearEscuchaLocal({
      onListo: () => { if (!cancelado) detector.alIniciar(); },
      onTexto: (t) => { if (!cancelado && !ignorar()) detector.alTexto([t]); },
      onAviso: (m) => { if (!cancelado) onEstado('cargando', m); },
      onError: (m) => {
        if (cancelado) return;
        detector.parar();
        onEstado('error', m);
      },
    });
  }).catch(() => {
    if (!cancelado) onEstado('error', 'No se pudo cargar el motor de voz local (Vosk).');
  });
  return () => {
    cancelado = true;
    detener?.();
    detector.parar();
    onEstado('apagada');
  };
}

/**
 * Escucha continua: Higia solo se activa cuando la nombran. "Higia, pide ayuda" se procesa directo;
 * si solo dice "Higia", se espera la frase siguiente. Devuelve una función para apagarla.
 */
export function escucharPalabraClave({ motor = 'navegador', onComando, onEstado, ignorar }: OpcionesEscucha): () => void {
  if (motor === 'ninguno') {
    onEstado('error', motivoSinReconocimiento() ?? 'Este navegador no tiene reconocimiento de voz.');
    return () => {};
  }
  const detector = crearDetector({ onComando, onEstado });
  return motor === 'local'
    ? escucharConLocal(detector, onEstado, ignorar)
    : escucharConNavegador(detector, onEstado, ignorar);
}

/**
 * Una sola frase, para el botón del micrófono. Elige el motor preferido: Vosk local o el del navegador.
 * Devuelve una función para cancelar.
 */
export function escucharFrase(
  onTexto: (t: string) => void,
  onFin: () => void,
  onError?: (mensaje: string) => void,
  motor: MotorVoz = motorVozPreferido(),
): () => void {
  if (motor === 'local') {
    let cancelado = false;
    let detener: (() => void) | undefined;
    void import('./motorLocal').then(({ escucharFraseLocal }) => {
      if (cancelado) return;
      detener = escucharFraseLocal(onTexto, onFin, onError);
    }).catch(() => {
      if (cancelado) return;
      onError?.('No se pudo cargar el motor de voz local (Vosk).');
      onFin();
    });
    return () => { cancelado = true; detener?.(); };
  }
  if (motor === 'ninguno') {
    onError?.(motivoSinReconocimiento() ?? 'Este navegador no tiene reconocimiento de voz.');
    onFin();
    return () => {};
  }
  return escuchar(onTexto, onFin, onError);
}

/** Escucha una frase con el motor nativo. Devuelve una función para cancelar. */
export function escuchar(onTexto: (t: string) => void, onFin: () => void, onError?: (mensaje: string) => void): () => void {
  const Ctor = ctorReconocimiento();
  if (!Ctor) {
    onError?.(motivoSinReconocimiento() ?? 'Este navegador no tiene reconocimiento de voz.');
    onFin();
    return () => {};
  }
  const r = new Ctor();
  r.lang = 'es-ES';
  r.continuous = false;
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => {
    const res = e.results[0];
    if (res?.isFinal) onTexto(res[0].transcript);
  };
  r.onend = onFin;
  r.onerror = (e: { error: string }) => {
    if (e.error !== 'aborted') onError?.(mensajeErrorReconocimiento(e.error));
    onFin();
  };
  try {
    r.start();
  } catch {
    onError?.('No se pudo iniciar el micrófono. Cierra otras pestañas o aplicaciones que lo estén usando y vuelve a intentarlo.');
    onFin();
  }
  return () => { try { r.abort(); } catch { /* ya detenido */ } };
}
