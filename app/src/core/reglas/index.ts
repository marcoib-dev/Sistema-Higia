import type { Regla } from '../tipos';
import { reglaArritmia, reglaFrecuenciaCardiaca, reglaPresionArterial, reglaTrombosis, reglaValsalva } from './cardiovascular';
import { reglaCargaEva, reglaDescompresion } from './eva';
import { reglaRuido } from './entorno';
import { reglaFiebre, reglaMicrobioma, reglaReactivacion } from './inmune';
import { reglaFatigaMenu, reglaGlucemia, reglaHidratacion, reglaIngesta, reglaPeso } from './metabolismo';
import { reglaAnimo, reglaAnimoSostenido, reglaCircadiano, reglaCohesion, reglaEstres, reglaSobrecarga, reglaSueno } from './mental';
import { reglaAdherencia, reglaAptitud, reglaCargaDinamica, reglaEjercicio, reglaFuerzaIsometrica, reglaHueso } from './musculoesqueletico';
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
  reglaMicrobioma,
  reglaIngesta,
  reglaPeso,
  reglaHidratacion,
  reglaFatigaMenu,
  reglaAdherencia,
  reglaAptitud,
  reglaHueso,
  reglaCargaDinamica,
  reglaRuido,
  reglaAnimoSostenido,
  reglaCohesion,
  reglaCircadiano,
  reglaSobrecarga,
  reglaFuerzaIsometrica,
  reglaValsalva,
];
