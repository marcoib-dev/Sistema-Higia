/**
 * PREGUNTAS PROACTIVAS — de vez en cuando Higia pregunta por su cuenta lo que le falta saber:
 * cómo está el ánimo, cuánto durmió, cuánta agua lleva, si tiene alguna molestia, o propone una
 * evaluación cognitiva breve. Elige la pregunta según qué dato falta o está desactualizado, así
 * no pregunta lo que ya sabe.
 *
 * Todo es local: la pregunta, la interpretación de la respuesta y el registro del dato.
 */
import type { NucleoSalud } from './nucleo';
import { palabrasANumeros } from './numeros';
import { enRango, type Contexto, type Perfil, type TipoSensor } from './tipos';

const HORA = 3_600_000;

const normalizar = (s: string) => palabrasANumeros(
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!]/g, '').replace(/(?<!\d)[.,;:]|[.,;:](?!\d)/g, ' ').replace(/\s+/g, ' ').trim(),
);

export const esAfirmativo = (frase: string) => /^(si|sip|claro|dale|ok|okey|vale|bueno|de acuerdo|adelante|empecemos|vamos|por supuesto|listo|perfecto)\b/.test(normalizar(frase));
export const esNegativo = (frase: string) => /^(no|nop|ahora no|despues|mas tarde|luego|ninguna|nada|estoy bien|todo bien|prefiero no|no gracias)\b/.test(normalizar(frase));

/** Primer número de la frase (en cifras o en palabras: "cinco y media" → 5.5). */
export function primerNumero(frase: string): number | null {
  const m = normalizar(frase).match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export type TipoPregunta = 'dato' | 'cognitiva' | 'abierta';

export interface PreguntaProactiva {
  id: string;
  tipo: TipoPregunta;
  texto: string;
  /** Dato que se registra con la respuesta (preguntas de tipo "dato"). */
  sensor?: TipoSensor;
  /** Convierte la respuesta en el valor del dato; null si no se entiende. */
  leer?: (frase: string) => number | null;
  /** Cómo se confirma lo registrado ("Anotado: 7 horas de sueño."). */
  confirmar?: (valor: number) => string;
}

interface Candidata extends PreguntaProactiva {
  /** Hace falta preguntarla ahora (el dato falta o está viejo). */
  vigente: (n: NucleoSalud, ahora: number) => boolean;
}

const sinDatoDesde = (n: NucleoSalud, s: TipoSensor, ahora: number, horas: number) => {
  const u = n.historial.ultima(s);
  return !u || ahora - u.timestamp > horas * HORA;
};

const escala = (s: TipoSensor) => (f: string) => {
  const v = primerNumero(f);
  return v === null ? null : enRango(s, v);
};

const CANDIDATAS: Candidata[] = [
  {
    id: 'cognitiva', tipo: 'cognitiva',
    texto: '¿Tienes dos minutos para una evaluación cognitiva rápida? Son seis preguntas cortas. Dime «sí» o «ahora no».',
    // Una por día; antes si la última salió más baja de lo habitual.
    vigente: (n, ahora) => {
      const u = n.historial.ultima('cognicion');
      if (!u) return true;
      const base = n.perfil.lineaBase.cognicion ?? 85;
      return ahora - u.timestamp > (u.valor < base * 0.85 ? 4 : 24) * HORA;
    },
  },
  {
    id: 'animo', tipo: 'dato', sensor: 'animo',
    texto: 'Una pregunta rápida: del 1 al 10, ¿cómo está tu ánimo ahora?',
    leer: escala('animo'),
    confirmar: (v) => `Anotado: ánimo ${v} de 10.${v <= 4 ? ' Gracias por decírmelo; si quieres hablar, aquí estoy.' : ''}`,
    vigente: (n, ahora) => sinDatoDesde(n, 'animo', ahora, 8),
  },
  {
    id: 'sueno', tipo: 'dato', sensor: 'horasSueno',
    texto: '¿Cuántas horas dormiste anoche?',
    leer: escala('horasSueno'),
    confirmar: (v) => `Anotado: ${v} horas de sueño.${v < 6 ? ' Es poco: intenta descansar antes de tareas exigentes.' : ''}`,
    vigente: (n, ahora) => sinDatoDesde(n, 'horasSueno', ahora, 16),
  },
  {
    id: 'agua', tipo: 'dato', sensor: 'hidratacion',
    texto: '¿Cuántos vasos de agua llevas hoy, más o menos?',
    leer: (f) => {
      const v = primerNumero(f);
      if (v === null) return null;
      const nf = normalizar(f);
      const ml = /litro/.test(nf) ? v * 1000 : /\bml\b|mililitro/.test(nf) ? v : v * 250;
      return enRango('hidratacion', Math.round(ml));
    },
    confirmar: (v) => `Anotado: unos ${v} mililitros de agua hoy.${v < 1500 ? ' Te conviene tomar un poco más.' : ''}`,
    vigente: (n, ahora) => sinDatoDesde(n, 'hidratacion', ahora, 5),
  },
  {
    id: 'molestias', tipo: 'abierta',
    texto: '¿Sientes alguna molestia o dolor en este momento?',
    vigente: () => true,
  },
  {
    id: 'equipo', tipo: 'dato', sensor: 'cohesionEquipo',
    texto: 'Del 1 al 10, ¿cómo te sientes trabajando con el equipo estos días?',
    leer: escala('cohesionEquipo'),
    confirmar: (v) => `Anotado: ${v} de 10. Gracias.`,
    vigente: (n, ahora) => sinDatoDesde(n, 'cohesionEquipo', ahora, 72),
  },
];

/** Una misma pregunta no se repite antes de esto. */
export const SEPARACION_MISMA_PREGUNTA = 2 * HORA;

/** ¿Está en su horario de sueño? (no se le pregunta nada). */
export function durmiendo(p: Perfil, c: Contexto): boolean {
  const { inicio, fin } = p.horarioSueno;
  return inicio < fin ? c.hora >= inicio && c.hora < fin : c.hora >= inicio || c.hora < fin;
}

/**
 * Elige la próxima pregunta: la primera vigente (en orden de prioridad) que no se haya hecho
 * hace poco. Devuelve null si no hay nada que preguntar o no es buen momento (sueño, EVA).
 */
export function elegirPreguntaProactiva(n: NucleoSalud, ahora: number, hechas: Record<string, number>): PreguntaProactiva | null {
  if (durmiendo(n.perfil, n.contexto) || n.contexto.ubicacion === 'eva') return null;
  const libres = CANDIDATAS.filter((c) => !hechas[c.id] || ahora - hechas[c.id] > SEPARACION_MISMA_PREGUNTA);
  const vigente = libres.find((c) => c.vigente(n, ahora));
  if (!vigente) return null;
  const { vigente: _v, ...pregunta } = vigente;
  return pregunta;
}

/** La pregunta por id (para lanzarla a pedido desde la UI). */
export function preguntaProactiva(id: string): PreguntaProactiva | undefined {
  const c = CANDIDATAS.find((x) => x.id === id);
  if (!c) return undefined;
  const { vigente: _v, ...pregunta } = c;
  return pregunta;
}
