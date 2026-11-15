/**
 * CATÁLOGO DE DATOS — cada dato que Higia puede recibir, con su nombre, unidad, familia y rango.
 * El simulador genera sus controles desde aquí; la voz y la IA validan sus entradas con estos rangos.
 * Se reexporta desde `tipos.ts`: impórtenlo de ahí.
 */

export type TipoSensor =
  // Signos vitales y dispositivos
  | 'frecuenciaCardiaca'  // lpm
  | 'presionSistolica'    // mmHg
  | 'presionDiastolica'   // mmHg
  | 'spo2'                // % saturación de oxígeno
  | 'temperatura'         // °C
  | 'estres'              // índice 0–100 (p. ej. derivado de VFC)
  | 'irregularidadRitmo'  // % de latidos irregulares (monitor cardíaco)
  // Síntomas reportados (intensidad 0–10)
  | 'marcadoresPsicoticos' // señales en la conversación (voces, ideas de persecución, discurso desorganizado)
  | 'sxCefalea' | 'sxNauseas' | 'sxMareo' | 'sxVision' | 'sxDisnea' | 'sxDolorArticular' | 'sxNeurologico'
  | 'sxPiel' | 'sxAlergia' | 'sxDigestivo' | 'sxDolorEspalda' | 'sxDolorPierna' | 'sxApetito'
  // Pruebas a bordo
  | 'orientacion'         // 0–10, chequeo de orientación (persona, lugar, tiempo, atención)
  | 'cognicion'           // 0–100, prueba cognitiva breve (tipo batería Cognition / WinSCAT)
  | 'tiempoReaccion'      // ms, prueba de vigilancia psicomotora (PVT)
  | 'equilibrio' | 'fuerza' | 'aptitudAerobica' | 'agudezaVisual' | 'presionIntraocular' | 'grosorRetina'
  | 'flujoYugular' | 'asimetriaPantorrilla'
  | 'fuerzaIsometrica'    // kg, contracción isométrica máxima (dinamómetro de prensión)
  | 'valsalva'            // cociente de Valsalva (FC máxima al pujar / FC mínima al soltar)
  // Hábitos y encuestas
  | 'horasSueno'          // horas de una noche
  | 'animo'               // autoevaluación 1–10
  | 'minutosEjercicio'    // minutos acumulados en el día
  | 'caloriasDia' | 'hidratacion' | 'pesoCorporal' | 'aceptabilidadComida' | 'minutosResistencia'
  | 'horasTrabajo' | 'desfaseCircadiano' | 'cohesionEquipo'
  // Traje y vehículo
  | 'impactoCabeza'       // g, pico de aceleración medido en el casco o el traje
  | 'duracionEva' | 'prerrespiracion' | 'aceleracionCuerpo'
  // Entorno y laboratorio
  | 'dosisRadiacion'      // mSv acumulados (dosímetro)
  | 'ppO2Cabina' | 'ruidoCabina' | 'cargaMicrobiana'
  | 'glucemia'            // mg/dL
  | 'calcioUrinario';

/** Familia de cada dato: el simulador agrupa sus controles por esto. */
export type CategoriaSensor = 'vital' | 'sintoma' | 'prueba' | 'habito' | 'traje' | 'entorno' | 'laboratorio';

export const CATEGORIAS_SENSOR: CategoriaSensor[] = ['vital', 'sintoma', 'prueba', 'habito', 'traje', 'entorno', 'laboratorio'];

export const NOMBRE_CATEGORIA_SENSOR: Record<CategoriaSensor, string> = {
  vital: 'Signos vitales', sintoma: 'Síntomas reportados', prueba: 'Pruebas a bordo', habito: 'Hábitos y encuestas',
  traje: 'Traje y vehículo', entorno: 'Entorno', laboratorio: 'Laboratorio',
};

export interface InfoSensor {
  nombre: string;
  unidad: string;
  categoria: CategoriaSensor;
  /** Rango válido: límites del control del simulador y de la validación de entradas (voz, IA). */
  min: number;
  max: number;
  paso: number;
  /** El astronauta lo puede reportar hablando. */
  porVoz?: boolean;
  /** Para el simulador y la IA: qué recoge el dato, en una frase. */
  ayuda?: string;
}

const sintoma = (nombre: string, ayuda: string): InfoSensor =>
  ({ nombre, unidad: '/10', categoria: 'sintoma', min: 0, max: 10, paso: 1, porVoz: true, ayuda });

/** Nombre, unidad y rango de cada dato. Lo usan la trazabilidad, el simulador y la validación de entradas. */
export const INFO_SENSOR: Record<TipoSensor, InfoSensor> = {
  // Signos vitales
  frecuenciaCardiaca: { nombre: 'Frecuencia cardíaca', unidad: 'lpm', categoria: 'vital', min: 25, max: 220, paso: 1, porVoz: true },
  presionSistolica: { nombre: 'Presión sistólica', unidad: 'mmHg', categoria: 'vital', min: 50, max: 240, paso: 1, porVoz: true },
  presionDiastolica: { nombre: 'Presión diastólica', unidad: 'mmHg', categoria: 'vital', min: 30, max: 150, paso: 1, porVoz: true },
  spo2: { nombre: 'Saturación de oxígeno', unidad: '%', categoria: 'vital', min: 60, max: 100, paso: 1, porVoz: true },
  temperatura: { nombre: 'Temperatura', unidad: '°C', categoria: 'vital', min: 32, max: 42, paso: 0.1, porVoz: true },
  estres: { nombre: 'Índice de estrés', unidad: '/100', categoria: 'vital', min: 0, max: 100, paso: 1, ayuda: 'Derivado de la variabilidad cardíaca' },
  irregularidadRitmo: { nombre: 'Latidos irregulares', unidad: '%', categoria: 'vital', min: 0, max: 40, paso: 1, ayuda: 'Del monitor cardíaco' },

  // Síntomas reportados
  marcadoresPsicoticos: { ...sintoma('Señales de alteración de la percepción', 'Voces, ideas de persecución, discurso desorganizado') },
  sxCefalea: sintoma('Dolor de cabeza', 'Dolor de cabeza'),
  sxNauseas: sintoma('Náuseas', 'Náuseas o vómitos'),
  sxMareo: sintoma('Mareo', 'Mareo, vértigo, desorientación espacial'),
  sxVision: sintoma('Cambios de visión', 'Visión borrosa o cambios de visión'),
  sxDisnea: sintoma('Falta de aire', 'Falta de aire'),
  sxDolorArticular: sintoma('Dolor articular', 'Dolor en hombros, codos o rodillas'),
  sxNeurologico: sintoma('Síntomas neurológicos', 'Hormigueo, debilidad de un lado, dificultad para hablar'),
  sxPiel: sintoma('Lesiones de piel', 'Erupción, herpes labial, lesiones de piel'),
  sxAlergia: sintoma('Síntomas de alergia', 'Congestión, estornudos o picazón atípicos'),
  sxDigestivo: sintoma('Síntomas digestivos', 'Diarrea, dolor abdominal'),
  sxDolorEspalda: sintoma('Dolor de espalda', 'Dolor de columna o lumbar'),
  sxDolorPierna: sintoma('Dolor de pierna', 'Dolor o hinchazón de una pierna'),
  sxApetito: sintoma('Pérdida de apetito', 'Falta de hambre, la comida aburre'),

  // Pruebas a bordo
  orientacion: { nombre: 'Chequeo de orientación', unidad: '/10', categoria: 'prueba', min: 0, max: 10, paso: 1 },
  cognicion: { nombre: 'Prueba cognitiva', unidad: '/100', categoria: 'prueba', min: 0, max: 100, paso: 1 },
  tiempoReaccion: { nombre: 'Tiempo de reacción (PVT)', unidad: 'ms', categoria: 'prueba', min: 150, max: 1000, paso: 5 },
  equilibrio: { nombre: 'Prueba de equilibrio', unidad: '/100', categoria: 'prueba', min: 0, max: 100, paso: 1, ayuda: 'Pruebas sensoriomotoras (Standard Measures)' },
  fuerza: { nombre: 'Fuerza corporal total', unidad: 'índice', categoria: 'prueba', min: 0, max: 120, paso: 1, ayuda: 'Prueba de fuerza corporal total' },
  aptitudAerobica: { nombre: 'Aptitud aeróbica', unidad: 'mL/kg/min', categoria: 'prueba', min: 15, max: 70, paso: 0.5, ayuda: 'Autoevaluación de aptitud (VO₂ estimado)' },
  agudezaVisual: { nombre: 'Prueba de visión', unidad: '/100', categoria: 'prueba', min: 0, max: 100, paso: 1, ayuda: 'Pruebas de visión (ISAFE)' },
  presionIntraocular: { nombre: 'Presión intraocular', unidad: 'mmHg', categoria: 'prueba', min: 5, max: 45, paso: 1, ayuda: 'Brain Fluid Pressure' },
  grosorRetina: { nombre: 'Cambio en la retina (OCT)', unidad: 'µm', categoria: 'prueba', min: -20, max: 120, paso: 1, ayuda: 'Cambio respecto del valor previo al vuelo' },
  flujoYugular: { nombre: 'Flujo en la vena yugular', unidad: 'grado', categoria: 'prueba', min: 1, max: 4, paso: 1, ayuda: 'Ecografía: 1 normal, 2 lento, 3 estancado, 4 retrógrado o trombo' },
  asimetriaPantorrilla: { nombre: 'Diferencia entre pantorrillas', unidad: 'cm', categoria: 'prueba', min: 0, max: 8, paso: 0.5, ayuda: 'Autoexamen con cinta métrica' },
  fuerzaIsometrica: { nombre: 'Fuerza isométrica (prensión)', unidad: 'kg', categoria: 'prueba', min: 5, max: 90, paso: 0.5, porVoz: true, ayuda: 'Contracción máxima sostenida 5 s en el dinamómetro de mano' },
  valsalva: { nombre: 'Cociente de Valsalva', unidad: 'cociente', categoria: 'prueba', min: 0.8, max: 2.5, paso: 0.01, porVoz: true, ayuda: 'Maniobra de Valsalva: FC máxima al pujar ÷ FC mínima al soltar (reflejo autonómico)' },

  // Hábitos y encuestas
  horasSueno: { nombre: 'Horas de sueño', unidad: 'h', categoria: 'habito', min: 0, max: 14, paso: 0.5, porVoz: true },
  animo: { nombre: 'Ánimo', unidad: '/10', categoria: 'habito', min: 1, max: 10, paso: 1, porVoz: true },
  minutosEjercicio: { nombre: 'Ejercicio del día', unidad: 'min', categoria: 'habito', min: 0, max: 300, paso: 5 },
  caloriasDia: { nombre: 'Calorías del día', unidad: 'kcal', categoria: 'habito', min: 0, max: 4500, paso: 50, porVoz: true, ayuda: 'Registro diario de comidas (Food Physiology)' },
  hidratacion: { nombre: 'Agua del día', unidad: 'mL', categoria: 'habito', min: 0, max: 5000, paso: 100, porVoz: true },
  pesoCorporal: { nombre: 'Peso corporal', unidad: 'kg', categoria: 'habito', min: 40, max: 130, paso: 0.1, porVoz: true },
  aceptabilidadComida: { nombre: 'Aceptabilidad de la comida', unidad: '/9', categoria: 'habito', min: 1, max: 9, paso: 1, porVoz: true, ayuda: 'Encuesta semanal (Food Acceptability)' },
  minutosResistencia: { nombre: 'Ejercicio de resistencia', unidad: 'min', categoria: 'habito', min: 0, max: 180, paso: 5 },
  horasTrabajo: { nombre: 'Horas de trabajo', unidad: 'h', categoria: 'habito', min: 0, max: 18, paso: 0.5, porVoz: true },
  desfaseCircadiano: { nombre: 'Desfase del sueño', unidad: 'h', categoria: 'habito', min: 0, max: 12, paso: 0.5, ayuda: 'Corrimiento del horario de sueño (actigrafía)' },
  cohesionEquipo: { nombre: 'Cohesión del equipo', unidad: '/10', categoria: 'habito', min: 1, max: 10, paso: 1, porVoz: true, ayuda: 'Encuesta conductual (ARCHeR)' },

  // Traje y vehículo
  impactoCabeza: { nombre: 'Impacto en la cabeza', unidad: 'g', categoria: 'traje', min: 0, max: 100, paso: 1 },
  duracionEva: { nombre: 'Duración de la EVA', unidad: 'min', categoria: 'traje', min: 0, max: 600, paso: 5, ayuda: 'Telemetría del traje' },
  prerrespiracion: { nombre: 'Prerrespiración de oxígeno', unidad: 'min', categoria: 'traje', min: 0, max: 300, paso: 5, ayuda: 'Minutos de oxígeno antes de esta EVA' },
  aceleracionCuerpo: { nombre: 'Carga en el cuerpo', unidad: 'g', categoria: 'traje', min: 0, max: 30, paso: 0.5, ayuda: 'Pico en el torso (asiento o traje)' },

  // Entorno
  dosisRadiacion: { nombre: 'Dosis de radiación acumulada', unidad: 'mSv', categoria: 'entorno', min: 0, max: 1000, paso: 0.5 },
  ppO2Cabina: { nombre: 'Oxígeno de la cabina (ppO₂)', unidad: 'kPa', categoria: 'entorno', min: 10, max: 25, paso: 0.1 },
  ruidoCabina: { nombre: 'Ruido de la cabina', unidad: 'dBA', categoria: 'entorno', min: 30, max: 90, paso: 1 },
  cargaMicrobiana: { nombre: 'Carga microbiana', unidad: 'UFC', categoria: 'entorno', min: 0, max: 500, paso: 5, ayuda: 'Hisopado de superficie o agua, por placa' },

  // Laboratorio
  glucemia: { nombre: 'Glucemia', unidad: 'mg/dL', categoria: 'laboratorio', min: 30, max: 400, paso: 1, porVoz: true },
  calcioUrinario: { nombre: 'Calcio en orina', unidad: 'mg/día', categoria: 'laboratorio', min: 50, max: 500, paso: 5 },
};

export const SENSORES = Object.keys(INFO_SENSOR) as TipoSensor[];

/** Recorta un valor al rango válido del dato. */
export function enRango(s: TipoSensor, v: number): number {
  const i = INFO_SENSOR[s];
  return Math.min(i.max, Math.max(i.min, v));
}

/** Es un nombre de dato conocido. */
export const esSensor = (s: string): s is TipoSensor => Object.prototype.hasOwnProperty.call(INFO_SENSOR, s);
