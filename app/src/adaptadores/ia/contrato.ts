/**
 * Contrato entre la app y el servidor de IA (app/server). Solo tipos y listas: lo importan los dos lados.
 */
import type { Actividad, Destino, Nivel, Ubicacion } from '../../core/tipos';

/** Datos que el astronauta puede reportar hablando y que la IA puede extraer. */
export const SENSORES_CONVERSACION = ['horasSueno', 'animo', 'minutosEjercicioRealizados'] as const;
export type SensorConversacion = (typeof SENSORES_CONVERSACION)[number];

export interface TurnoConversacion {
  rol: 'astronauta' | 'higia';
  texto: string;
}

/** Foto del estado que se envía a la IA. Nunca incluye el nombre del astronauta. */
export interface EstadoParaIA {
  perfil: { formacionMedica: string; experiencia: string; toleranciaEstres: string; propensoPanico: boolean };
  contexto: Record<string, unknown>;
  hallazgos: { titulo: string; nivel: Nivel; detalle: string; sensible: boolean }[];
  ultimasLecturas: Record<string, number>;
}

export interface PeticionConversacion {
  frase: string;
  historial: TurnoConversacion[];
  estado: EstadoParaIA;
}

export interface RespuestaConversacion {
  respuesta: string;
  lecturas: { sensor: SensorConversacion; valor: number }[];
}

export interface PeticionEntorno {
  /** JPEG en base64, sin el prefijo data: */
  imagen: string;
  contexto: Record<string, unknown>;
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
export interface PeticionEvaluacion {
  hallazgo: { titulo: string; nivel: Nivel; resumen: string; detalle: string; accion: string; sensible: boolean; fuente: string };
  /** Lo que Higia ya le dijo al astronauta (texto del motor local). */
  mensaje: string;
  estado: EstadoParaIA;
}

export interface EvaluacionIA {
  /** Evaluación personalizada: qué significa ahora, considerando el resto del estado. */
  evaluacion: string;
  /** Qué hacer a continuación, en una oración. */
  recomendacion: string;
}
