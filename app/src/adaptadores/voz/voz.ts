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
