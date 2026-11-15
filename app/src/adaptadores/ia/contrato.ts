/**
 * Contrato entre la app y el servidor de IA (app/server). Solo tipos y listas: lo importan los dos lados.
 */
import type { Accion } from '../../core/acciones';
import { INFO_SENSOR, SENSORES, type Actividad, type Destino, type HistoriaClinica, type Nivel, type TipoSensor, type Ubicacion } from '../../core/tipos';

/**
 * Datos que el astronauta puede reportar hablando y que la IA puede extraer: salen del catálogo
 * (`porVoz`), más el caso especial de los minutos de ejercicio que acaba de hacer (se suman a los del día).
 */
export type SensorConversacion = TipoSensor | 'minutosEjercicioRealizados';
export const SENSORES_CONVERSACION: [SensorConversacion, ...SensorConversacion[]] = [
  'minutosEjercicioRealizados',
  ...SENSORES.filter((s) => INFO_SENSOR[s].porVoz),
];

export interface TurnoConversacion {
  rol: 'astronauta' | 'higia';
  texto: string;
}

/** Foto del estado que se envía a la IA. Nunca incluye el nombre del astronauta. */
export interface EstadoParaIA {
  perfil: {
    formacionMedica: string; experiencia: string; toleranciaEstres: string; propensoPanico: boolean;
    /** Historia clínica previa a la misión (sin nombre). */
    historiaClinica: HistoriaClinica;
  };
  contexto: Record<string, unknown>;
  /**
   * El momento actual en palabras: la IA no tiene reloj propio, así que la hora, la fecha y el día
   * de misión le llegan siempre aquí (son los mismos que ve el astronauta en la barra superior).
   */
  momento: {
    horaHabitat: string;
    fecha: string;
    parteDelDia: string;
    diaMision: number;
    horarioSueno: string;
    enHorarioDeSueno: boolean;
  };
  /** El contexto descrito en una frase (dónde está, qué hace, quién está cerca, conexión). */
  entorno: string;
  /** Tareas críticas que hoy están contraindicadas, con el motivo. */
  aptitudTareas: { tarea: string; apto: boolean; motivos: string[] }[];
  /** Nombres de los compañeros de tripulación (para entender a quién se refiere). */
  companeros: string[];
  hallazgos: { titulo: string; nivel: Nivel; detalle: string; sensible: boolean; riesgosNASA?: string[] }[];
  ultimasLecturas: Record<string, number>;
  /** Últimas lecturas por dato (hasta 5), con unidad y antigüedad: la base de cualquier análisis. */
  lecturasRecientes: Record<string, { valor: number; unidad: string; haceMin: number }[]>;
  /** Valores habituales de la persona (antes de la misión). */
  lineaBase: Record<string, number>;
  /** Estado de la app, para que el asistente pueda controlarla. */
  app?: {
    seccion: string;
    /** Prueba o pregunta en curso que Higia le hizo al astronauta, si hay. */
    enCurso?: string;
    alertasEsperandoRespuesta: string[];
    comunicacionesRecientes: { destinatario: string; asunto: string; estado: string }[];
    destinosDisponibles: string[];
    escenariosDemo: { id: string; nombre: string }[];
    astronautasDemo: { id: string; nombre: string; actual: boolean }[];
  };
}

export interface PeticionConversacion {
  frase: string;
  historial: TurnoConversacion[];
  estado: EstadoParaIA;
  /** Idioma en el que debe responder la IA. */
  idioma?: 'es' | 'en';
}

export interface RespuestaConversacion {
  respuesta: string;
  lecturas: { sensor: SensorConversacion; valor: number }[];
  /** Acciones que el asistente pide ejecutar en la app (ya validadas). */
  acciones: Accion[];
}

export interface PeticionEntorno {
  /** JPEG en base64, sin el prefijo data: */
  imagen: string;
  contexto: Record<string, unknown>;
  idioma?: 'es' | 'en';
}

export interface AnalisisEntorno {
  descripcion: string;
  ubicacion: Ubicacion | 'desconocida';
  destino: Destino | 'desconocido';
  actividad: Actividad | 'desconocida';
  peligros: string[];
  recomendacion: string;
}

export interface EstadoIA {
  configurada: boolean;
  modelo: string;
}

/** Hallazgo del motor de reglas que la IA evalúa en el contexto del estado completo. */
export interface DatoParaIA {
  dato: string;
  valor: number;
  unidad: string;
  haceMin: number;
  lineaBase?: number;
}

export interface PeticionEvaluacion {
  hallazgo: {
    titulo: string; nivel: Nivel; resumen: string; detalle: string; accion: string; sensible: boolean; fuente: string;
    /** Riesgos del HRP de la NASA a los que responde el hallazgo. */
    riesgosNASA?: string[];
    /** Datos exactos en que se basó el motor de reglas. */
    datos: DatoParaIA[];
    /** Serie reciente de esos mismos datos, para ver la tendencia. */
    series: Record<string, { valor: number; haceMin: number }[]>;
  };
  /** Lo que Higia ya le dijo al astronauta (texto del motor local). */
  mensaje: string;
  estado: EstadoParaIA;
  idioma?: 'es' | 'en';
}

export interface EvaluacionIA {
  /** Evaluación personalizada: qué significa ahora, considerando el resto del estado. */
  evaluacion: string;
  /** Qué hacer a continuación, en una oración. */
  recomendacion: string;
  /** Datos concretos (con su valor) en que se apoya la evaluación. */
  datosUsados: string[];
  /** Qué datos faltan o qué limita la evaluación ("" si nada). */
  limitaciones: string;
}
