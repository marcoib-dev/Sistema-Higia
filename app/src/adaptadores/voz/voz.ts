/**
 * ADAPTADOR DE VOZ — Web Speech API del navegador.
 * - Síntesis (hablar): funciona sin conexión con las voces del sistema.
 * - Reconocimiento (escuchar): en Chrome usa servidores de Google, así que NO es autónomo.
 *   TODO (línea D): reemplazar por un motor local (p. ej. Vosk o whisper.cpp) para la versión final.
 */

export function sintesisDisponible(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function hablar(texto: string): void {
  if (!sintesisDisponible()) return;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-ES';
  window.speechSynthesis.speak(u);
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
