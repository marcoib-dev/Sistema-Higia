import type { Regla } from '../tipos';
import { reglaFrecuenciaCardiaca, reglaPresionArterial } from './cardiovascular';
import { reglaFiebre, reglaReactivacion } from './inmune';
import { reglaGlucemia } from './metabolismo';
import { reglaAnimo, reglaEstres, reglaSueno } from './mental';
import { reglaEjercicio } from './musculoesqueletico';
import { reglaOrientacion, reglaPsicosis, reglaTraumaCraneal } from './neuro';
import { reglaRadiacion } from './radiacion';
import { reglaSaturacionOxigeno } from './respiratorio';

/** Para agregar un riesgo: crea la regla con `definirRegla` y súmala aquí. */
export const REGLAS: Regla[] = [
  reglaFrecuenciaCardiaca,
  reglaPresionArterial,
  reglaSaturacionOxigeno,
  reglaSueno,
  reglaAnimo,
  reglaEstres,
  reglaEjercicio,
  reglaRadiacion,
  reglaTraumaCraneal,
  reglaOrientacion,
  reglaPsicosis,
  reglaFiebre,
  reglaReactivacion,
  reglaGlucemia,
];
