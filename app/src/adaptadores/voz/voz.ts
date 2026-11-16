/**
 * ADAPTADOR DE VOZ — Web Speech API del navegador.
 * - Síntesis (hablar): voz neuronal local (Piper, sin conexión) y, de respaldo, las voces del sistema. Se puede pausar, detener y ajustar el volumen.
 * - Reconocimiento (escuchar): en Chrome usa servidores de Google, así que NO es autónomo.
 *   TODO (línea D): reemplazar por un motor local (p. ej. Vosk o whisper.cpp) para la versión final.
 */

import { estadoPiper, sintetizar } from './piper';
import { esNatural, mejorVozNavegador, type IdiomaVoz } from './vocesNavegador';

let volumen = 1;

export function sintesisDisponible(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Idioma en que habla Higia: el de la página (lo fija el selector ES/EN). */
const idiomaVoz = (): IdiomaVoz => (typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'en' : 'es');
const enLinea = () => typeof navigator === 'undefined' || navigator.onLine;

/**
 * Qué motor dice la próxima frase:
 * - Una voz neuronal del navegador (Edge «Natural», Apple «Premium») con internet: suena mejor que Piper.
 * - Si no la hay, o no hay internet: Piper, que es neuronal y local (solo habla español).
 * - Si Piper no está lista: la mejor voz del navegador que haya.
 */
function usarPiper(): boolean {
  if (estadoPiper() !== 'lista' || idiomaVoz() !== 'es') return false;
  const nav = mejorVozNavegador('es');
  return !(nav && esNatural(nav) && enLinea());
}

/** Qué voz está hablando: la neuronal local (Piper) o la del navegador. */
export function motorSintesis(): 'neuronal' | 'navegador' | 'cargando' {
  if (usarPiper()) return 'neuronal';
  const nav = mejorVozNavegador(idiomaVoz());
  if (nav && esNatural(nav)) return 'navegador';
  return estadoPiper() === 'cargando' ? 'cargando' : 'navegador';
}

/** Nombre de la voz del navegador que se usaría ahora (para mostrarlo). */
export function nombreVozNavegador(): string | undefined {
  return mejorVozNavegador(idiomaVoz())?.name;
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
  const idioma = idiomaVoz();
  const voz = mejorVozNavegador(idioma);
  if (voz) u.voice = voz;
  u.lang = voz?.lang ?? (idioma === 'en' ? 'en-US' : 'es-AR');
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
  if (usarPiper()) encolarNeuronal(texto, alTerminar);
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

/** Saludos que pueden ir antes del nombre ("Oye, Higia…"). */
const SALUDO = /^(?:(?:oye|hola|ey|hey|ok|okey|eh)[\s,]+)?/;

/**
 * Cómo suena una palabra, para comparar sin depender de la ortografía que elija el reconocedor:
 * la h es muda, «gi/ge» y «j» suenan igual, «y» y «ll» como «i», «gu» delante de i/e como «g».
 */
export function sonido(palabra: string): string {
  return normalizarVoz(palabra)
    .replace(/[^a-zñ]/g, '')
    .replace(/h/g, '')
    .replace(/gu(?=[ie])/g, 'g')
    .replace(/g(?=[ie])/g, 'j')
    .replace(/ll|y/g, 'i')
    .replace(/(.)\1+/g, '$1');
}

/** Distancia de edición (cuántas letras cambiar, sacar o poner para pasar de una a otra). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

const SONIDO_HIGIA = sonido('Higia');

/**
 * Llamado por parecido: la primera palabra (o las dos primeras juntas, «hi jia») suena a «Higia»
 * con a lo sumo una letra de diferencia. Así se activa aunque no se marque la tilde al decirla
 * («hija», «ija», «gía», «ilia»), pero no con palabras que solo se le parecen de lejos («día», «tía», «hijo»).
 */
function llamadoPorSonido(normal: string): string | null {
  const saludo = normal.match(SALUDO)![0];
  const resto = normal.slice(saludo.length);
  const palabras = resto.match(/^(\S+)(?:\s+(\S+))?/);
  if (!palabras) return null;
  const parecido = (p: string) => p.length >= 3 && distancia(p, SONIDO_HIGIA) <= 1;
  const [, primera, segunda] = palabras;
  const una = primera.replace(/[\s,.:!?]+$/, '');
  let largo = 0;
  if (parecido(sonido(una))) largo = primera.length;
  else if (segunda && /^(?:y|hi|i)$/.test(una) && parecido(sonido(una + segunda))) largo = palabras[0].length;
  if (!largo) return null;
  const fin = resto.slice(largo).match(/^[\s,.:!?]*/)![0];
  return normal.slice(0, saludo.length + largo + fin.length);
}

/** ¿La frase empieza llamando a Higia? Devuelve el resto (el pedido), sin el nombre. */
export function detectarLlamado(texto: string): { llamado: boolean; resto: string } {
  const original = texto.trim().normalize('NFC');
  const normal = normalizarVoz(original);
  const exacto = normal.match(LLAMADO)?.[0];
  const m = exacto ?? llamadoPorSonido(normal);
  if (!m) return { llamado: false, resto: original };
  // Se recorta el original (con sus tildes) avanzando letra por letra hasta cubrir lo que coincidió.
  let consumido = 0;
  let i = 0;
  while (i < original.length && consumido < m.length) consumido += normalizarVoz(original[i++]).length;
  return { llamado: true, resto: original.slice(i).trim() };
}

export type EstadoEscucha = 'apagada' | 'cargando' | 'esperando' | 'llamado' | 'error';

interface OpcionesEscucha {
  /** Pedido completo después de «Higia» (o la frase siguiente, si solo dijo «Higia»). */
  onComando: (texto: string) => void;
  onEstado: (e: EstadoEscucha, detalle?: string) => void;
  /**
   * Lo que se va oyendo mientras habla (antes de que termine la frase), sin el nombre de Higia.
   * Cadena vacía cuando la frase terminó o se descartó.
   */
  onParcial?: (texto: string) => void;
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
  /**
   * Resultado parcial (la frase todavía no terminó): si ya se oyó «Higia», se avisa al instante
   * para que la interfaz lo muestre sin esperar al final de la frase.
   */
  alParcial(texto: string): void;
  /** El motor arrancó: publica «esperando» o «llamado» según la ventana actual. */
  alIniciar(): void;
  parar(): void;
}

/** Máquina de estados de «Higia»: llamado, espera de 8 s y respuestas sin nombrarla. */
function crearDetector({ onComando, onEstado, onParcial }: Pick<OpcionesEscucha, 'onComando' | 'onEstado' | 'onParcial'>): Detector {
  let esperaHasta = 0;
  /** Ya se avisó «llamado» por un resultado parcial de esta frase. */
  let llamadoParcial = false;
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
    alParcial(texto) {
      const t = texto.trim();
      if (!t) return;
      const d = detectarLlamado(t);
      const atento = Date.now() < esperaHasta || respuestaSinNombreActiva();
      if (d.llamado) {
        if (!llamadoParcial) { llamadoParcial = true; onEstado('llamado'); }
        onParcial?.(d.resto);
      } else if (atento) {
        onParcial?.(t);
      }
    },
    alTexto(alternativas) {
      const habiaParcial = llamadoParcial;
      llamadoParcial = false;
      onParcial?.('');
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
      } else if (habiaParcial) {
        // El parcial sonaba a «Higia» pero la frase final no: se vuelve a esperar.
        onEstado('esperando');
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
    // Resultados parciales: «Higia» se reconoce mientras se habla, no al terminar la frase.
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.onresult = (e: { resultIndex: number; results: { isFinal: boolean; length: number; [i: number]: { transcript: string } }[] }) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (!res.isFinal) {
          if (!ignorar()) detector.alParcial(res[0].transcript);
          continue;
        }
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
      onParcial: (t) => { if (!cancelado && !ignorar()) detector.alParcial(t); },
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
export function escucharPalabraClave({ motor = 'navegador', onComando, onEstado, onParcial, ignorar }: OpcionesEscucha): () => void {
  if (motor === 'ninguno') {
    onEstado('error', motivoSinReconocimiento() ?? 'Este navegador no tiene reconocimiento de voz.');
    return () => {};
  }
  const detector = crearDetector({ onComando, onEstado, onParcial });
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

// ── Señal sonora al oír «Higia» ─────────────────────────────────────────

let contextoSonido: AudioContext | undefined;

/**
 * Dos notas cortas y suaves que confirman «te escucho» (como el tono de un asistente).
 * No suena si el volumen está en cero. Si el navegador no permite audio todavía, no pasa nada.
 */
export function sonarLlamado(): void {
  if (volumen === 0 || typeof AudioContext === 'undefined') return;
  try {
    contextoSonido ??= new AudioContext();
    const ctx = contextoSonido;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    [[660, 0], [990, 0.09]].forEach(([f, d]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(0.12 * volumen, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.22);
      osc.connect(g).connect(ctx.destination);
      osc.start(t + d);
      osc.stop(t + d + 0.25);
    });
  } catch { /* sin audio */ }
}
