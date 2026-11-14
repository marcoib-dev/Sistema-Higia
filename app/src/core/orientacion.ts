/**
 * CHEQUEO DE ORIENTACIÓN — cuatro preguntas rápidas que Higia hace por voz o texto:
 * persona, lugar, tiempo y atención. Se evalúa en el dispositivo (sin IA ni red) y el resultado
 * entra como dato ("orientacion", 0–10) a las reglas de desorientación y de traumatismo craneal.
 */
import type { Contexto, Perfil } from './tipos';

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, ' ');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const LUGAR: Record<Contexto['ubicacion'], RegExp> = {
  habitat: /habitat|base|modulo|estacion|adentro|dentro|casa/,
  eva: /\beva\b|afuera|fuera|exterior|superficie|caminata|paseo espacial/,
  rover: /rover|vehiculo|explorador/,
};
const DESTINO: Record<Contexto['destino'], RegExp> = { luna: /\bluna\b|lunar/, marte: /\bmarte\b|marciano/, orbita: /orbita|estacion espacial/ };
const OTRO_MUNDO = /\btierra\b|\bcasa de mis padres\b|\bhospital\b/;

interface Pregunta {
  area: 'persona' | 'lugar' | 'tiempo' | 'atencion';
  texto: string;
  correcta: (respuesta: string) => boolean;
}

/** Puntaje 0–10 según los aciertos (de 4). */
export const PUNTAJE_ORIENTACION = [0, 3, 5, 7, 10];

export class ChequeoOrientacion {
  private readonly preguntas: Pregunta[];
  private paso = 0;
  readonly respuestas: { area: Pregunta['area']; respuesta: string; correcta: boolean }[] = [];

  constructor(perfil: Perfil, contexto: Contexto, ahora = Date.now()) {
    const nombre = normalizar(perfil.nombre.split(' ')[0]).trim();
    const mes = new Date(ahora).getMonth();
    this.preguntas = [
      { area: 'persona', texto: '¿Cómo te llamas?', correcta: (r) => normalizar(r).includes(nombre) },
      {
        area: 'lugar', texto: '¿Dónde estás ahora?',
        correcta: (r) => {
          const f = normalizar(r);
          if (OTRO_MUNDO.test(f) && !DESTINO[contexto.destino].test(f)) return false;
          return LUGAR[contexto.ubicacion].test(f) || DESTINO[contexto.destino].test(f);
        },
      },
      {
        area: 'tiempo', texto: '¿En qué mes estamos?',
        correcta: (r) => { const f = normalizar(r); return f.includes(MESES[mes]) || new RegExp(`\\b${mes + 1}\\b`).test(f); },
      },
      { area: 'atencion', texto: '¿Cuánto es veinte menos siete?', correcta: (r) => /\b13\b|trece/.test(normalizar(r)) },
    ];
  }

  get total(): number { return this.preguntas.length; }
  get terminado(): boolean { return this.paso >= this.preguntas.length; }
  get aciertos(): number { return this.respuestas.filter((r) => r.correcta).length; }
  /** Puntaje 0–10 (solo tiene sentido al terminar). */
  get valor(): number { return PUNTAJE_ORIENTACION[Math.round((this.aciertos / this.total) * 4)]; }

  pregunta(): string | undefined { return this.preguntas[this.paso]?.texto; }

  /** Registra la respuesta a la pregunta actual y avanza. */
  responder(respuesta: string): boolean {
    const p = this.preguntas[this.paso];
    if (!p) return false;
    const correcta = p.correcta(respuesta);
    this.respuestas.push({ area: p.area, respuesta, correcta });
    this.paso++;
    return correcta;
  }
}
