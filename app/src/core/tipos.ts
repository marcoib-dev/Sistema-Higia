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
  | 'dosisRadiacion';     // mSv acumulados (dosímetro)

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
  escalamiento?: { destinos: string[]; motivo: string };
  timestamp: number;
}

export type EstadoCorporal = Record<SistemaCorporal, Nivel | 'sinDatos'>;
