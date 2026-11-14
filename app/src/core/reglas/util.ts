import type { Historial } from '../historial';
import type { Contexto, Hallazgo, Perfil, Regla } from '../tipos';

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

export type DatosHallazgo = Omit<Hallazgo, 'riesgoId' | 'sistema' | 'fuente' | 'timestamp'>;

/** Crea una regla completando automáticamente id, sistema, fuente y timestamp del hallazgo. */
export function definirRegla(
  meta: Omit<Regla, 'evaluar'>,
  evaluar: (h: Historial, p: Perfil, ahora: number, c: Contexto) => DatosHallazgo | null,
): Regla {
  return {
    ...meta,
    evaluar(h, p, ahora, c) {
      const d = evaluar(h, p, ahora, c);
      return d && { ...d, riesgoId: meta.id, sistema: meta.sistema, fuente: meta.fuente, timestamp: ahora };
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
