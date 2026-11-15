/**
 * EL MOMENTO ACTUAL, en palabras: hora del hábitat, fecha y día de misión.
 * Lo usan la barra superior, el intérprete local y la IA, para que todos digan lo mismo.
 */
import type { Contexto } from './tipos';

const dos = (n: number) => String(n).padStart(2, '0');

/**
 * Hora del hábitat (HH:MM). La hora la fija el reloj de la misión (`contexto.hora`, que el simulador
 * puede adelantar); los minutos corren con el reloj real.
 */
export function horaHabitat(c: Pick<Contexto, 'hora'>, ahora = Date.now()): string {
  return `${dos(c.hora)}:${dos(new Date(ahora).getMinutes())}`;
}

/** "domingo, 15 de noviembre de 2026" */
export function fechaLegible(ahora = Date.now()): string {
  return new Date(ahora).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Parte del día según la hora del hábitat, para saludar o contextualizar. */
export function parteDelDia(hora: number): 'madrugada' | 'mañana' | 'tarde' | 'noche' {
  return hora < 6 ? 'madrugada' : hora < 12 ? 'mañana' : hora < 20 ? 'tarde' : 'noche';
}
