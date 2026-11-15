/**
 * CATÁLOGO DE ESCENARIOS del simulador, agrupados por categoría.
 * Los `id` se conservan entre versiones: los usan la acción `ejecutar_escenario` y la IA.
 */
import { ESCENARIOS_CONDUCTA } from './conducta';
import { ESCENARIOS_FISIOLOGIA } from './fisiologia';
import type { Escenario } from './modelo';
import { ESCENARIOS_RADIACION } from './radiacion';
import { ESCENARIOS_SISTEMA } from './sistema';

export * from './modelo';

export const ESCENARIOS: Escenario[] = [
  ...ESCENARIOS_SISTEMA,
  ...ESCENARIOS_FISIOLOGIA,
  ...ESCENARIOS_CONDUCTA,
  ...ESCENARIOS_RADIACION,
];

/** Orden del guion para el pitch (~5 minutos). Se completa con los escenarios nuevos. */
export const GUION_DEMO: string[] = ['base', 'eva-estres', 'crisis', 'animo', 'tormenta'];

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Busca por id o por nombre (lo que diga el asistente). */
export function buscarEscenario(q: string): Escenario | undefined {
  const n = normal(q);
  return ESCENARIOS.find((e) => e.id === q || normal(e.nombre) === n) ?? ESCENARIOS.find((e) => normal(e.nombre).includes(n));
}
