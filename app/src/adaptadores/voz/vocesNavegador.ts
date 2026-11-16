/**
 * VOCES DEL NAVEGADOR — elige la mejor voz del sistema en vez de dejar la que el navegador toma
 * por defecto (en Windows suele ser la de escritorio, la más robótica).
 *
 * Orden de calidad:
 *  1. Neuronales: «Natural» de Edge (p. ej. «Microsoft Elena Online (Natural) - Spanish (Argentina)»)
 *     y las «Premium/Enhanced» de Apple. Suenan casi humanas; las «Online» necesitan internet.
 *  2. Las de Google en Chrome.
 *  3. Cualquier otra del idioma.
 * Dentro de cada nivel se prefiere el acento rioplatense en español y el estadounidense en inglés.
 */

export type IdiomaVoz = 'es' | 'en';

/** Lo que se usa de SpeechSynthesisVoice (así se puede probar sin navegador). */
export interface VozInfo {
  name: string;
  lang: string;
  localService: boolean;
}

/** Voz neuronal del sistema: suena mejor que Piper, así que con internet tiene prioridad. */
export const esNatural = (v: VozInfo) => /natural|premium|enhanced|neural/i.test(v.name);

const ACENTO: Record<IdiomaVoz, [RegExp, number][]> = {
  es: [[/^es[-_]AR/i, 30], [/^es[-_](419|MX|US|CO|CL|UY)/i, 15], [/^es[-_]ES/i, 10]],
  en: [[/^en[-_]US/i, 10], [/^en[-_]GB/i, 5]],
};

/**
 * Puntaje de una voz para un idioma; -1 si no sirve (otro idioma, o necesita internet y no hay).
 * Más alto es mejor.
 */
export function puntuarVoz(v: VozInfo, idioma: IdiomaVoz, enLinea = true): number {
  if (!v.lang.toLowerCase().startsWith(idioma)) return -1;
  if (!enLinea && !v.localService) return -1;
  let p = 0;
  if (esNatural(v)) p += 100;
  else if (/google/i.test(v.name)) p += 50;
  if (/espeak/i.test(v.name)) p -= 40;
  for (const [re, extra] of ACENTO[idioma]) if (re.test(v.lang)) { p += extra; break; }
  return p;
}

/** La mejor voz de la lista para ese idioma, o null si no hay ninguna. */
export function elegirVoz<V extends VozInfo>(voces: readonly V[], idioma: IdiomaVoz, enLinea = true): V | null {
  let mejor: V | null = null;
  let puntaje = -1;
  for (const v of voces) {
    const p = puntuarVoz(v, idioma, enLinea);
    if (p > puntaje) { mejor = v; puntaje = p; }
  }
  return mejor;
}

// ── Lista de voces del sistema: llega tarde en Chrome/Edge (evento voiceschanged) ──
let voces: SpeechSynthesisVoice[] = [];

function cargarVoces(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  voces = window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cargarVoces();
  window.speechSynthesis.addEventListener?.('voiceschanged', cargarVoces);
}

/** La mejor voz del navegador ahora mismo para ese idioma. */
export function mejorVozNavegador(idioma: IdiomaVoz): SpeechSynthesisVoice | null {
  if (!voces.length) cargarVoces();
  const enLinea = typeof navigator === 'undefined' ? true : navigator.onLine;
  return elegirVoz(voces, idioma, enLinea);
}
