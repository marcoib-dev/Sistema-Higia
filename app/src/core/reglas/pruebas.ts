/** Ayudantes para los tests de reglas (no es un test). */
import { PERFILES } from '../../adaptadores/simulador/perfiles';
import { Historial } from '../historial';
import type { Contexto, Hallazgo, Lectura, Perfil, Regla, TipoSensor } from '../tipos';
import { expect } from 'vitest';

export const [ANA, LUIS, KAI, IRENE] = PERFILES;
export const T = new Date(2026, 10, 14, 12, 0, 0).getTime();
export const HABITAT: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 12,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: false, medicoABordo: false, conexionHabitat: false, conexionTierra: false,
  diaMision: 45, transicionGravedad: false,
};
export const L = (sensor: TipoSensor, valor: number, t = T): Lectura => ({ sensor, valor, timestamp: t, fuente: 'simulador' });

/** Evalúa una regla sola sobre un historial armado con esas lecturas. */
export function evaluar(
  regla: Regla, lecturas: Lectura[], o: { perfil?: Perfil; contexto?: Partial<Contexto>; ahora?: number } = {},
): Hallazgo | null {
  const h = new Historial();
  lecturas.forEach((l) => h.agregar(l));
  return regla.evaluar(h, o.perfil ?? LUIS, o.ahora ?? T, { ...HABITAT, ...o.contexto });
}

/** Toda alerta lleva guía paso a paso (§7.2.4: operar sin ayuda de Tierra). */
export const conPasosSiAlerta = (x: Hallazgo | null) => {
  if (x?.nivel === 'alerta') expect(x.pasos?.length, x.titulo).toBeGreaterThan(1);
  return x;
};
