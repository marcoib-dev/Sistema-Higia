/**
 * CONTRATOS DE DATOS — el acuerdo común entre todas las líneas de trabajo.
 * Si cambian algo aquí, avísenle al equipo: lo usan el motor, la GUI, la voz y la interoperabilidad.
 */
import type { Historial } from './historial';

// ── Cuerpo ──────────────────────────────────────────────────────────────
export type SistemaCorporal =
  | 'cerebro' | 'ojos' | 'oidoInterno' | 'corazon' | 'pulmones' | 'inmune'
  | 'intestino' | 'huesos' | 'musculos' | 'piernas' | 'metabolismo' | 'cuerpo';

export const SISTEMAS: SistemaCorporal[] = [
  'cerebro', 'ojos', 'oidoInterno', 'corazon', 'pulmones', 'inmune',
  'intestino', 'huesos', 'musculos', 'piernas', 'metabolismo', 'cuerpo',
];

export const NOMBRE_SISTEMA: Record<SistemaCorporal, string> = {
  cerebro: 'Cerebro / mente', ojos: 'Ojos', oidoInterno: 'Oído interno',
  corazon: 'Corazón y vasos', pulmones: 'Pulmones', inmune: 'Sistema inmune',
  intestino: 'Intestino', huesos: 'Huesos', musculos: 'Músculos',
  piernas: 'Piernas', metabolismo: 'Metabolismo', cuerpo: 'Todo el cuerpo (radiación)',
};

// ── Entradas: lecturas de sensores ──────────────────────────────────────
export type TipoSensor =
  | 'frecuenciaCardiaca'  // lpm
  | 'presionSistolica'    // mmHg
  | 'presionDiastolica'   // mmHg
  | 'spo2'                // % saturación de oxígeno
  | 'temperatura'         // °C
  | 'glucemia'            // mg/dL
  | 'horasSueno'          // horas de una noche
  | 'animo'               // autoevaluación 1–10
  | 'estres'              // índice 0–100 (p. ej. derivado de VFC)
  | 'minutosEjercicio'    // minutos acumulados en el día
  | 'dosisRadiacion'      // mSv acumulados (dosímetro)
  | 'orientacion'         // 0–10, chequeo de orientación (persona, lugar, tiempo, atención)
  | 'cognicion'           // 0–100, prueba cognitiva breve (tipo batería Cognition / WinSCAT)
  | 'tiempoReaccion'      // ms, prueba de vigilancia psicomotora (PVT)
  | 'marcadoresPsicoticos' // 0–10, señales en la conversación (voces, ideas de persecución, discurso desorganizado)
  | 'impactoCabeza';      // g, pico de aceleración medido en el casco o el traje

/** Nombre y unidad de cada dato, para mostrar qué datos usó cada análisis. */
export const INFO_SENSOR: Record<TipoSensor, { nombre: string; unidad: string }> = {
  frecuenciaCardiaca: { nombre: 'Frecuencia cardíaca', unidad: 'lpm' },
  presionSistolica: { nombre: 'Presión sistólica', unidad: 'mmHg' },
  presionDiastolica: { nombre: 'Presión diastólica', unidad: 'mmHg' },
  spo2: { nombre: 'Saturación de oxígeno', unidad: '%' },
  temperatura: { nombre: 'Temperatura', unidad: '°C' },
  glucemia: { nombre: 'Glucemia', unidad: 'mg/dL' },
  horasSueno: { nombre: 'Horas de sueño', unidad: 'h' },
  animo: { nombre: 'Ánimo', unidad: '/10' },
  estres: { nombre: 'Índice de estrés', unidad: '/100' },
  minutosEjercicio: { nombre: 'Ejercicio del día', unidad: 'min' },
  dosisRadiacion: { nombre: 'Dosis de radiación acumulada', unidad: 'mSv' },
  orientacion: { nombre: 'Chequeo de orientación', unidad: '/10' },
  cognicion: { nombre: 'Prueba cognitiva', unidad: '/100' },
  tiempoReaccion: { nombre: 'Tiempo de reacción (PVT)', unidad: 'ms' },
  marcadoresPsicoticos: { nombre: 'Señales de alteración de la percepción', unidad: '/10' },
  impactoCabeza: { nombre: 'Impacto en la cabeza', unidad: 'g' },
};

/** Dato concreto en el que se apoya un análisis clínico (trazabilidad). */
export interface DatoClinico {
  sensor: TipoSensor;
  valor: number;
  timestamp: number;
  fuente: Lectura['fuente'];
  /** Valor habitual de la persona, si la regla lo compara. */
  lineaBase?: number;
}

/** Región del cuerpo: permite señalar dónde está el problema (p. ej. un golpe en el cráneo). */
export type RegionCuerpo = 'craneo' | 'cara' | 'cuello' | 'torax' | 'abdomen' | 'columna' | 'pelvis' | 'brazos' | 'piernas';
export const REGIONES: RegionCuerpo[] = ['craneo', 'cara', 'cuello', 'torax', 'abdomen', 'columna', 'pelvis', 'brazos', 'piernas'];

export interface Lectura {
  sensor: TipoSensor;
  valor: number;
  timestamp: number; // ms epoch
  fuente: 'sensor' | 'voz' | 'manual' | 'simulador';
}

// ── Niveles ─────────────────────────────────────────────────────────────
export type Nivel = 'normal' | 'info' | 'aviso' | 'alerta';
export const ORDEN_NIVEL: Record<Nivel, number> = { normal: 0, info: 1, aviso: 2, alerta: 3 };

// ── Perfil del astronauta ───────────────────────────────────────────────
export type FormacionMedica = 'ninguna' | 'basica' | 'medico';
export type Experiencia = 'novato' | 'intermedio' | 'veterano';
export type ToleranciaEstres = 'baja' | 'media' | 'alta';

export interface Perfil {
  id: string;
  nombre: string;
  rol: string;
  formacionMedica: FormacionMedica;
  experiencia: Experiencia;
  toleranciaEstres: ToleranciaEstres;
  /** Sabe que puede tener ataques de pánico: no se le recuerda constantemente. */
  propensoPanico: boolean;
  /** Valores personales previos a la misión; las reglas comparan contra esto. */
  lineaBase: Partial<Record<TipoSensor, number>>;
  /** Horas (0–24) del horario de sueño. */
  horarioSueno: { inicio: number; fin: number };
  /** Historia clínica previa a la misión: la usan la IA, las evaluaciones y las comunicaciones de emergencia. */
  historiaClinica: HistoriaClinica;
}

// ── Historia clínica previa ─────────────────────────────────────────────
/** Antecedente médico, opcionalmente asociado a un sistema del cuerpo (para destacarlo en sus hallazgos). */
export interface Antecedente {
  nombre: string;
  sistema?: SistemaCorporal;
  detalle?: string;
}

export interface HistoriaClinica {
  edad: number;
  sexo: 'femenino' | 'masculino' | 'otro';
  grupoSanguineo: string;
  alergias: string[];
  /** Condiciones crónicas o previas relevantes. */
  antecedentes: Antecedente[];
  medicacion: string[];
  cirugias: string[];
  antecedentesFamiliares: string[];
  /** Vacunas o aptitudes médicas relevantes para la misión. */
  notas: string[];
}

/** Antecedentes de la historia clínica que tocan un sistema del cuerpo. */
export function antecedentesDe(h: HistoriaClinica, sistema: SistemaCorporal): Antecedente[] {
  return h.antecedentes.filter((a) => a.sistema === sistema);
}

/** Resumen de una línea para comunicaciones de emergencia (lo que un rescatista necesita saber primero). */
export function resumenClinico(h: HistoriaClinica): string {
  const partes = [
    `${h.edad} años`,
    `grupo ${h.grupoSanguineo}`,
    `alergias: ${h.alergias.length ? h.alergias.join(', ') : 'ninguna conocida'}`,
  ];
  if (h.antecedentes.length) partes.push(`antecedentes: ${h.antecedentes.map((a) => a.nombre).join(', ')}`);
  if (h.medicacion.length) partes.push(`medicación: ${h.medicacion.join(', ')}`);
  return partes.join(' · ');
}

// ── Comunicaciones con otros ────────────────────────────────────────────
export type DestinoComunicacion = 'companero' | 'medico' | 'base' | 'tierra' | 'baliza';

export const NOMBRE_DESTINO_COMUNICACION: Record<DestinoComunicacion, string> = {
  companero: 'Compañero cercano', medico: 'Médico de a bordo', base: 'Base más cercana',
  tierra: 'Control en Tierra', baliza: 'Baliza de emergencia',
};

/**
 * Un mensaje que Higia envía a otra persona: por una escalada (alerta sin respuesta)
 * o porque el astronauta se lo pidió al asistente ("pide ayuda", "avísale a Tierra que…").
 */
export interface Comunicacion {
  id: string;
  destino: DestinoComunicacion;
  /** Nombre visible del destinatario (p. ej. "Kai Tanaka (compañero cercano)"). */
  destinatario: string;
  origen: 'escalada' | 'asistente';
  /** Una emergencia pide ayuda; una nota solo informa. */
  tipo: 'emergencia' | 'nota';
  asunto: string;
  texto: string;
  /** enviado: salió; enCola: sin enlace, sale al reconectar; respondido: hubo respuesta. */
  estado: 'enviado' | 'enCola' | 'respondido';
  /** Retardo de la comunicación, si aplica (Tierra). */
  retardo?: string;
  respuesta?: { texto: string; timestamp: number };
  timestamp: number;
}

// ── Contexto: dónde está, qué hace y qué hay disponible ─────────────────
export type Ubicacion = 'habitat' | 'eva' | 'rover';
export type Destino = 'orbita' | 'luna' | 'marte';
export type Actividad = 'reposo' | 'trabajo' | 'ejercicio';
export type ClimaEspacial = 'calmo' | 'tormentaSolar';

export interface Contexto {
  ubicacion: Ubicacion;
  destino: Destino;
  actividad: Actividad;
  climaEspacial: ClimaEspacial;
  /** Hora local del hábitat, 0–23. */
  hora: number;
  pantallaHabitat: boolean;
  pantallaPersonal: boolean;
  auricular: boolean;
  /** Hay un compañero al alcance de la radio de proximidad (no necesita la red del hábitat). */
  companeroCercano: boolean;
  /** No siempre hay alguien con formación médica en la tripulación. */
  medicoABordo: boolean;
  conexionHabitat: boolean;
  conexionTierra: boolean;
}

/** Retardo de la comunicación con Tierra (solo ida), según el destino. */
export const RETARDO_TIERRA: Record<Destino, string> = {
  orbita: 'menos de 1 s',
  luna: '~1,3 s',
  marte: 'entre 3 y 22 min',
};

export const NOMBRE_DESTINO: Record<Destino, string> = { orbita: 'Órbita', luna: 'Luna', marte: 'Marte' };

// ── Salida del motor de detección ───────────────────────────────────────
export type Ruta = 'autogestion' | 'reporte';

export interface Hallazgo {
  riesgoId: string;
  sistema: SistemaCorporal;
  nivel: Nivel;
  titulo: string;
  /** Para quien no tiene formación médica: qué pasa, sin cifras. */
  resumenSimple: string;
  /** Para quien sí sabe interpretar: cifras y contexto. */
  detalleTecnico: string;
  /** Versión sin palabras alarmantes, para perfiles con baja tolerancia al estrés. */
  textoCalmado?: string;
  accion: string;
  accionPorUbicacion?: Partial<Record<Ubicacion, string>>;
  /** Guía paso a paso para cuando no hay médico a bordo. */
  pasos?: string[];
  /** El astronauta podría no estar en condiciones de responder (hipoxia, desmayo…): se escala antes. */
  posibleIncapacidad?: boolean;
  ruta: Ruta;
  /** Salud mental u otros datos privados: nunca a una pantalla compartida. */
  sensible: boolean;
  /** Referencia al documento del desafío (anexo/tabla) que respalda la regla. */
  fuente: string;
  timestamp: number;
  /** Datos exactos en que se basó el análisis (trazabilidad clínica). */
  datos?: DatoClinico[];
  /** Región del cuerpo afectada, si se conoce (se destaca en la figura). */
  region?: RegionCuerpo;
}

export interface Regla {
  id: string;
  nombre: string;
  sistema: SistemaCorporal;
  /** Sensores que disparan la regla: solo se evalúa cuando llega uno de estos (ahorro de energía). */
  sensores: TipoSensor[];
  fuente: string;
  /** Devuelve null si no hay datos suficientes. El contexto permite ajustar la evaluación (p. ej. en ejercicio). */
  evaluar(h: Historial, p: Perfil, ahora: number, c: Contexto): Hallazgo | null;
}

// ── Salida hacia el astronauta ──────────────────────────────────────────
export type Canal = 'pantallaHabitat' | 'pantallaPersonal' | 'auricular' | 'figura';

export interface Mensaje {
  id: string;
  hallazgo: Hallazgo;
  texto: string;
  canal: Canal;
  voz: boolean;
  interrumpir: boolean;
  /** Retenido (p. ej. horario de sueño) hasta que cambie el contexto. */
  diferido: boolean;
  /** Por qué se eligió este canal: se muestra en la demo para explicar las reglas. */
  motivo: string;
  esRecordatorio: boolean;
  reporte?: string;
  /** Guía paso a paso (solo si no hay médico a bordo y el astronauta no tiene formación médica). */
  pasos?: string[];
  /** Las alertas piden confirmación ("Estoy bien"); si no llega a tiempo, se escala. */
  requiereConfirmacion: boolean;
  /** Presente si este mensaje es una escalada por falta de respuesta. */
  escalamiento?: { destinos: string[]; motivo: string; origen?: 'escalada' | 'asistente'; comunicaciones?: string[] };
  timestamp: number;
}

export type EstadoCorporal = Record<SistemaCorporal, Nivel | 'sinDatos'>;
