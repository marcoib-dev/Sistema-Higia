import type { Regla } from '../tipos';
import { reglaArritmia, reglaFrecuenciaCardiaca, reglaPresionArterial, reglaTrombosis } from './cardiovascular';
import { reglaCargaEva, reglaDescompresion } from './eva';
import { reglaFiebre, reglaReactivacion } from './inmune';
import { reglaGlucemia } from './metabolismo';
import { reglaAnimo, reglaEstres, reglaSueno } from './mental';
import { reglaEjercicio } from './musculoesqueletico';
import { reglaOrientacion, reglaPsicosis, reglaTraumaCraneal } from './neuro';
import { reglaSANS } from './ojos';
import { reglaRadiacion } from './radiacion';
import { reglaHipoxiaCabina, reglaSaturacionOxigeno } from './respiratorio';
import { reglaCinetosis, reglaEquilibrio } from './sensoriomotor';

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
  reglaCinetosis,
  reglaEquilibrio,
  reglaArritmia,
  reglaTrombosis,
  reglaDescompresion,
  reglaHipoxiaCabina,
  reglaCargaEva,
  reglaSANS,
];
