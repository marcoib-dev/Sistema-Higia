/**
 * EVALUACIÓN COGNITIVA BREVE — seis preguntas que Higia hace por voz o texto, al estilo de las
 * baterías breves que usa la NASA a bordo (Cognition / WinSCAT): memoria inmediata, atención,
 * cálculo, orientación temporal, razonamiento y recuerdo diferido.
 *
 * Se evalúa en el dispositivo (sin IA ni red). El puntaje (0–100) entra como dato "cognicion"
 * a la regla de rendimiento cognitivo, que lo compara con la línea base de la persona.
 * No es un diagnóstico: detecta cambios respecto de lo habitual para esa persona.
 */
import { palabrasANumeros } from './numeros';

const normalizar = (s: string) => palabrasANumeros(
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim(),
);

export type DominioCognitivo = 'memoria' | 'atencion' | 'calculo' | 'orientacion' | 'razonamiento' | 'recuerdo';

export const NOMBRE_DOMINIO: Record<DominioCognitivo, string> = {
  memoria: 'Memoria inmediata', atencion: 'Atención', calculo: 'Cálculo', orientacion: 'Orientación en el tiempo',
  razonamiento: 'Razonamiento', recuerdo: 'Recuerdo diferido',
};

interface Item {
  dominio: DominioCognitivo;
  texto: string;
  maximo: number;
  /** Puntos obtenidos (0…maximo) con esta respuesta. */
  puntuar: (respuesta: string) => number;
}

/** Grupos de tres palabras sin relación entre sí (memoria). Se elige uno al azar. */
const PALABRAS = [
  ['luna', 'llave', 'naranja'],
  ['casco', 'rio', 'violeta'],
  ['cohete', 'manzana', 'puente'],
  ['estrella', 'martillo', 'limon'],
  ['planeta', 'cuchara', 'verde'],
];
/** Cómo se escriben con tilde (para decirlas bien). */
const CON_TILDE: Record<string, string> = { rio: 'río', limon: 'limón' };

const DIGITO: Record<string, string> = {
  cero: '0', uno: '1', un: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
};

/** Los dígitos dichos uno por uno ("nueve, ocho, siete, dos" → "9872"); no los suma como un número. */
function digitosDichos(r: string): string {
  return r.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/)
    .map((t) => (/^\d+$/.test(t) ? t : DIGITO[t] ?? '')).join('');
}

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const aciertosPalabras = (palabras: string[], respuesta: string) => {
  const f = normalizar(respuesta);
  return palabras.filter((p) => new RegExp(`\\b${p}`).test(f)).length;
};

export interface ResultadoItem {
  dominio: DominioCognitivo;
  respuesta: string;
  puntos: number;
  maximo: number;
  /** Cuánto tardó en responder (desde que se hizo la pregunta). */
  ms: number;
}

export class EvaluacionCognitiva {
  private readonly items: Item[];
  private paso = 0;
  private preguntadaEn = 0;
  readonly resultados: ResultadoItem[] = [];
  readonly palabras: string[];

  constructor(ahora = Date.now(), azar: () => number = Math.random) {
    const elegir = <T>(xs: T[]) => xs[Math.floor(azar() * xs.length) % xs.length];
    this.palabras = elegir(PALABRAS);
    const dichas = this.palabras.map((p) => CON_TILDE[p] ?? p);
    const digitos = Array.from({ length: 4 }, () => 1 + Math.floor(azar() * 9));
    // Sin dígitos repetidos seguidos: se dicen mejor y se recuerdan igual de difícil.
    for (let i = 1; i < digitos.length; i++) if (digitos[i] === digitos[i - 1]) digitos[i] = (digitos[i] % 9) + 1;
    const inicio = elegir([100, 90, 80, 70]);
    const resta = elegir([7, 6, 8]);
    const horaEva = elegir([8, 9, 10, 11]);
    const duracion = elegir([5, 6, 7]);
    const fin = horaEva + duracion;
    const dia = DIAS[new Date(ahora).getDay()];

    this.items = [
      {
        dominio: 'memoria', maximo: 3,
        texto: `Te voy a decir tres palabras; recuérdalas, porque te las pediré al final: ${dichas.join(', ')}. Repítelas ahora.`,
        puntuar: (r) => aciertosPalabras(this.palabras, r),
      },
      {
        dominio: 'atencion', maximo: 2,
        texto: `Dime estos números al revés: ${digitos.join(', ')}.`,
        puntuar: (r) => {
          const dichos = digitosDichos(r);
          const esperado = [...digitos].reverse().join('');
          if (dichos === esperado) return 2;
          // Un solo número cambiado de lugar u olvidado: medio punto de atención.
          return dichos.length >= 3 && esperado.startsWith(dichos.slice(0, 2)) ? 1 : 0;
        },
      },
      {
        dominio: 'calculo', maximo: 2,
        texto: `Réstale ${resta} a ${inicio}, y al resultado vuelve a restarle ${resta}. ¿Qué número te queda?`,
        puntuar: (r) => {
          const f = normalizar(r);
          if (new RegExp(`\\b${inicio - 2 * resta}\\b`).test(f)) return 2;
          return new RegExp(`\\b${inicio - resta}\\b`).test(f) ? 1 : 0;
        },
      },
      {
        dominio: 'orientacion', maximo: 1,
        texto: '¿Qué día de la semana es hoy?',
        puntuar: (r) => (normalizar(r).includes(dia) ? 1 : 0),
      },
      {
        dominio: 'razonamiento', maximo: 2,
        texto: `Si una caminata espacial empieza a las ${horaEva} de la mañana y dura ${duracion} horas, ¿a qué hora termina?`,
        puntuar: (r) => {
          // "A la una de la tarde": aquí «una» es una hora.
          const f = normalizar(r.replace(/\buna\b/gi, '1'));
          return new RegExp(`\\b(${fin}|${fin - 12})\\b`).test(f) ? 2 : 0;
        },
      },
      {
        dominio: 'recuerdo', maximo: 3,
        texto: '¿Cuáles eran las tres palabras que te pedí recordar al principio?',
        puntuar: (r) => aciertosPalabras(this.palabras, r),
      },
    ];
  }

  get total(): number { return this.items.length; }
  get respondidas(): number { return this.paso; }
  get terminado(): boolean { return this.paso >= this.items.length; }
  get maximo(): number { return this.items.reduce((a, i) => a + i.maximo, 0); }
  get puntos(): number { return this.resultados.reduce((a, r) => a + r.puntos, 0); }
  /** Puntaje 0–100 (solo tiene sentido al terminar). */
  get valor(): number { return Math.round((this.puntos / this.maximo) * 100); }
  /** Tiempo medio de respuesta, en segundos (informativo: incluye el tiempo de hablar o escribir). */
  get latenciaMedia(): number {
    return this.resultados.length ? Math.round(this.resultados.reduce((a, r) => a + r.ms, 0) / this.resultados.length / 100) / 10 : 0;
  }
  /** Dominio de la pregunta actual (para mostrar el progreso). */
  get dominioActual(): DominioCognitivo | undefined { return this.items[this.paso]?.dominio; }

  pregunta(ahora = Date.now()): string | undefined {
    const p = this.items[this.paso];
    if (p && !this.preguntadaEn) this.preguntadaEn = ahora;
    return p?.texto;
  }

  /** Registra la respuesta a la pregunta actual y avanza. Devuelve los puntos obtenidos. */
  responder(respuesta: string, ahora = Date.now()): number {
    const p = this.items[this.paso];
    if (!p) return 0;
    const puntos = Math.max(0, Math.min(p.maximo, p.puntuar(respuesta)));
    this.resultados.push({ dominio: p.dominio, respuesta, puntos, maximo: p.maximo, ms: this.preguntadaEn ? ahora - this.preguntadaEn : 0 });
    this.paso++;
    this.preguntadaEn = 0;
    return puntos;
  }

  /** Dominios con algún error, para el resumen ("atención, recuerdo diferido"). */
  dominiosConFallas(): string[] {
    return this.resultados.filter((r) => r.puntos < r.maximo).map((r) => NOMBRE_DOMINIO[r.dominio].toLowerCase());
  }
}
