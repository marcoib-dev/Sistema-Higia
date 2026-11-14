import type { Historial } from '../historial';
import type { Contexto, DatoClinico, Hallazgo, Lectura, Perfil, Regla } from '../tipos';

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

export type DatosHallazgo = Omit<Hallazgo, 'riesgoId' | 'sistema' | 'fuente' | 'timestamp'>;

/** El dato de una lectura, con la línea base de la persona si la tiene. */
export function dato(l: Lectura, p: Perfil): DatoClinico {
  return { sensor: l.sensor, valor: l.valor, timestamp: l.timestamp, fuente: l.fuente, lineaBase: p.lineaBase[l.sensor] };
}

/**
 * Crea una regla completando automáticamente id, sistema, fuente y timestamp del hallazgo.
 * Si la regla no dice qué datos usó, se registran las últimas lecturas de sus sensores:
 * todo análisis queda trazable a los datos concretos en que se apoya.
 */
export function definirRegla(
  meta: Omit<Regla, 'evaluar'>,
  evaluar: (h: Historial, p: Perfil, ahora: number, c: Contexto) => DatosHallazgo | null,
): Regla {
  return {
    ...meta,
    evaluar(h, p, ahora, c) {
      const d = evaluar(h, p, ahora, c);
      if (!d) return null;
      const datos = d.datos ?? meta.sensores.map((s) => h.ultima(s)).filter((l): l is Lectura => !!l).map((l) => dato(l, p));
      return { ...d, datos, riesgoId: meta.id, sistema: meta.sistema, fuente: meta.fuente, timestamp: ahora };
    },
  };
}

export function normal(titulo: string, detalleTecnico: string, sensible = false): DatosHallazgo {
  return {
    nivel: 'normal', titulo, detalleTecnico, resumenSimple: 'Todo en orden.',
    accion: '', ruta: 'autogestion', sensible,
  };
}

export const r1 = (x: number) => Math.round(x * 10) / 10;
export const signo = (x: number) => (x >= 0 ? `+${r1(x)}` : `${r1(x)}`);
