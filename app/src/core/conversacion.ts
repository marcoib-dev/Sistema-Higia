/**
 * MODO CONVERSACIONAL — interpreta frases en español (de voz o de texto).
 * Es un intérprete por palabras clave, liviano y sin conexión. Se puede ampliar con más intenciones.
 */
import type { NucleoSalud } from './nucleo';
import { redactar } from './personalizador';
import { ORDEN_NIVEL, type Lectura, type TipoSensor } from './tipos';

export interface Respuesta {
  texto: string;
  /** Lecturas a registrar en el núcleo (si la frase era un registro). */
  lecturas: Lectura[];
}

const NUMEROS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, veinte: 20, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, noventa: 90,
};

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!]/g, '');

function numero(token: string): number | null {
  const n = parseFloat(token.replace(',', '.'));
  if (!Number.isNaN(n)) return n;
  return NUMEROS[token] ?? null;
}

const CONSULTAS: { claves: RegExp; riesgoId: string; nombre: string }[] = [
  { claves: /presion/, riesgoId: 'cardio.presion', nombre: 'presión arterial' },
  { claves: /pulso|ritmo|frecuencia|corazon/, riesgoId: 'cardio.frecuencia', nombre: 'frecuencia cardíaca' },
  { claves: /oxigeno|saturacion|respir/, riesgoId: 'pulmones.spo2', nombre: 'oxígeno' },
  { claves: /sueno|dormido|descans/, riesgoId: 'sueno.deficit', nombre: 'sueño' },
  { claves: /estres|nervio|ansie/, riesgoId: 'mental.estres', nombre: 'estrés' },
  { claves: /animo/, riesgoId: 'mental.animo', nombre: 'ánimo' },
  { claves: /ejercicio|entren/, riesgoId: 'musculo.ejercicio', nombre: 'ejercicio' },
  { claves: /radiacion|dosis/, riesgoId: 'radiacion.dosis', nombre: 'radiación' },
];

export function interpretar(frase: string, nucleo: NucleoSalud, ahora = Date.now()): Respuesta {
  const f = normalizar(frase).trim();
  const lectura = (sensor: TipoSensor, valor: number): Lectura => ({ sensor, valor, timestamp: ahora, fuente: 'voz' });

  // ── Registros ──
  let m = f.match(/dormi\s+(\S+)\s+horas?/);
  if (m && numero(m[1]) !== null) {
    const v = numero(m[1])!;
    return { texto: `Anotado: dormiste ${v} horas.`, lecturas: [lectura('horasSueno', v)] };
  }
  m = f.match(/animo\s+(?:es\s+|de\s+|esta\s+en\s+|en\s+)?(\S+)/);
  if (m && numero(m[1]) !== null) {
    const v = Math.min(10, Math.max(1, numero(m[1])!));
    return { texto: `Anotado tu ánimo: ${v} de 10. Gracias por registrarlo.`, lecturas: [lectura('animo', v)] };
  }
  m = f.match(/(?:hice|entrene)\s+(\S+)\s+minutos/);
  if (m && numero(m[1]) !== null) {
    const v = numero(m[1])!;
    const previo = nucleo.historial.ultima('minutosEjercicio');
    const mismoDia = previo && new Date(previo.timestamp).toDateString() === new Date(ahora).toDateString();
    const total = (mismoDia ? previo.valor : 0) + v;
    return { texto: `Anotado: ${v} minutos. Llevas ${total} hoy.`, lecturas: [lectura('minutosEjercicio', total)] };
  }

  // ── Consultas ──
  if (/como estoy|resumen|estado general/.test(f)) {
    const problemas = nucleo.hallazgosActuales().filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso);
    if (!problemas.length) return { texto: 'Todo en orden. No hay avisos activos.', lecturas: [] };
    return { texto: `Hay ${problemas.length} punto(s) a atender: ${problemas.map((h) => h.titulo).join('; ')}.`, lecturas: [] };
  }
  for (const c of CONSULTAS) {
    if (c.claves.test(f)) {
      const h = nucleo.hallazgo(c.riesgoId);
      if (!h) return { texto: `Todavía no tengo datos de ${c.nombre}.`, lecturas: [] };
      return { texto: redactar(h, nucleo.perfil, nucleo.contexto), lecturas: [] };
    }
  }

  return {
    texto: 'No te entendí. Puedes preguntar «¿cómo está mi presión?» o decir «dormí cinco horas».',
    lecturas: [],
  };
}
