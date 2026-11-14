/**
 * ADAPTADOR DE VOZ — Web Speech API del navegador.
 * - Síntesis (hablar): funciona sin conexión con las voces del sistema. Se puede pausar, detener y ajustar el volumen.
 * - Reconocimiento (escuchar): en Chrome usa servidores de Google, así que NO es autónomo.
 *   TODO (línea D): reemplazar por un motor local (p. ej. Vosk o whisper.cpp) para la versión final.
 */

let volumen = 1;

export function sintesisDisponible(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Volumen de 0 a 1. Se aplica a los mensajes siguientes (la Web Speech API no cambia el que está sonando). */
export function fijarVolumen(v: number): void {
  volumen = Math.min(1, Math.max(0, v));
}

export function hablar(texto: string, alTerminar?: () => void): void {
  if (!sintesisDisponible() || volumen === 0) {
    alTerminar?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-ES';
  u.volume = volumen;
  if (alTerminar) {
    u.onend = () => alTerminar();
    u.onerror = () => alTerminar();
  }
  window.speechSynthesis.speak(u);
}

export function pausar(): void {
  if (sintesisDisponible()) window.speechSynthesis.pause();
}

export function reanudar(): void {
  if (sintesisDisponible()) window.speechSynthesis.resume();
}

/** Corta lo que está diciendo y vacía la cola. */
export function detener(): void {
  if (sintesisDisponible()) window.speechSynthesis.cancel();
}

export function estadoVoz(): 'hablando' | 'pausada' | 'callada' {
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

// ── Palabra clave «Higia» ──────────────────────────────────────────────

const normalizarVoz = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Formas en que el reconocedor suele escribir «Higia» (Higía, Igia, Hijia, Hygeia, «y gía»…).
 * Solo cuenta como llamado al principio de la frase o después de un saludo ("oye Higia", "hola Higia"),
 * para no activarse cuando el nombre aparece en medio de otra conversación.
 */
const LLAMADO = /^(?:(?:oye|hola|ey|hey|ok|okey|eh)[\s,]+)?(?:h?i[gj]i?ia|h?i[gj]ia|hygeia|higea|y gia|lijia)\b[\s,.:!?]*/;

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

export type EstadoEscucha = 'apagada' | 'esperando' | 'llamado' | 'error';

interface OpcionesEscucha {
  /** Pedido completo después de «Higia» (o la frase siguiente, si solo dijo «Higia»). */
  onComando: (texto: string) => void;
  onEstado: (e: EstadoEscucha, detalle?: string) => void;
  /** Mientras devuelva true, lo que se oye se ignora (p. ej. mientras Higia habla, para no escucharse a sí misma). */
  ignorar: () => boolean;
}

/** Tras decir solo «Higia», cuánto tiempo se espera el pedido. */
const ESPERA_PEDIDO_MS = 8000;

/** Hasta cuándo se acepta una respuesta sin nombrar a Higia (cuando ella acaba de hacer una pregunta). */
let respuestaHasta = 0;

/** Higia hizo una pregunta: la próxima frase se toma como respuesta aunque no la nombren. */
export function aceptarRespuestaSinNombre(ms: number): void {
  respuestaHasta = Date.now() + ms;
}

/**
 * Escucha continua: Higia solo se activa cuando la nombran. "Higia, pide ayuda" se procesa directo;
 * si solo dice "Higia", se espera la frase siguiente. El navegador corta la escucha cada tanto, así que
 * se reinicia sola mientras esté encendida. Devuelve una función para apagarla.
 */
export function escucharPalabraClave({ onComando, onEstado, ignorar }: OpcionesEscucha): () => void {
  const Ctor = ctorReconocimiento();
  if (!Ctor) {
    onEstado('error', 'Este navegador no tiene reconocimiento de voz (usa Chrome o Edge).');
    return () => {};
  }
  let activa = true;
  let esperaHasta = 0;
  let reintento: ReturnType<typeof setTimeout> | undefined;
  let r: InstanceType<ReconocedorCtor> | null = null;

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
        if (ignorar()) continue;
        // Entre las alternativas, la que contenga el llamado (el reconocedor a veces lo escribe distinto).
        const alternativas = Array.from({ length: res.length }, (_, k) => res[k].transcript);
        const conLlamado = alternativas.map(detectarLlamado).find((d) => d.llamado);
        if (conLlamado) {
          if (conLlamado.resto) { esperaHasta = 0; onEstado('esperando'); onComando(conLlamado.resto); }
          else { esperaHasta = Date.now() + ESPERA_PEDIDO_MS; onEstado('llamado'); }
        } else if (Date.now() < esperaHasta || Date.now() < respuestaHasta) {
          esperaHasta = 0;
          respuestaHasta = 0;
          onEstado('esperando');
          onComando(alternativas[0].trim());
        }
      }
      if (esperaHasta && Date.now() >= esperaHasta) { esperaHasta = 0; onEstado('esperando'); }
    };
    r.onerror = (e: { error: string }) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        activa = false;
        onEstado('error', 'Sin permiso para usar el micrófono.');
      }
      // no-speech, aborted, network: onend reinicia.
    };
    r.onend = () => {
      if (!activa) return;
      reintento = setTimeout(iniciar, 400);
    };
    try {
      r.start();
      onEstado(Date.now() < esperaHasta ? 'llamado' : 'esperando');
    } catch {
      reintento = setTimeout(iniciar, 1000);
    }
  };

  iniciar();
  return () => {
    activa = false;
    clearTimeout(reintento);
    try { r?.abort(); } catch { /* ya detenido */ }
    onEstado('apagada');
  };
}

/** Escucha una frase. Devuelve una función para cancelar. */
export function escuchar(onTexto: (t: string) => void, onFin: () => void): () => void {
  const Ctor = ctorReconocimiento();
  if (!Ctor) {
    onFin();
    return () => {};
  }
  const r = new Ctor();
  r.lang = 'es-ES';
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.onresult = (e: { results: { 0: { transcript: string } }[] }) => onTexto(e.results[0][0].transcript);
  r.onend = onFin;
  r.onerror = onFin;
  r.start();
  return () => r.abort();
}
