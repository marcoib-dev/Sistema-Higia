/**
 * MODELO DE ESCENARIO — datos declarativos con una línea de tiempo y el resultado esperado.
 * El mismo catálogo sirve para la demo en vivo y como suite de tests (escenarios.test.ts).
 */
import type { Historial } from '../../../core/historial';
import type { IdRiesgoHRP, Peligro } from '../../../core/riesgosHRP';
import type { Contexto, Lectura, Nivel, Perfil, TipoSensor } from '../../../core/tipos';
import type { ConductaTripulacion } from '../tripulacion';

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

export interface Esperado { riesgoId: string; nivel: Nivel }

export interface PasoEscenario {
  /** Desde el inicio del escenario. */
  enMs: number;
  /** "El dolor empeora" */
  titulo: string;
  /** Qué está pasando, para quien presenta. */
  narracion: string;
  contexto?: Partial<Contexto>;
  lecturas?: (t: number, h: Historial, p: Perfil) => Lectura[];
  /** Lo que "dice" el astronauta: pasa por el asistente, como si lo hubiera dicho. */
  frase?: string;
  tripulacion?: Partial<ConductaTripulacion>;
  /** Hallazgos y niveles que deben quedar después de este paso. */
  esperado?: Esperado[];
  /** Después de este paso ningún hallazgo puede superar este nivel (p. ej. el día normal). */
  sinHallazgosSobre?: Nivel;
  /** El paso consiste en no responder: el reproductor espera a que Higia escale. */
  esperaEscalada?: boolean;
}

export type CategoriaEscenario = 'fisiologia' | 'conducta' | 'radiacion' | 'entorno' | 'sistema';

export const NOMBRE_CATEGORIA_ESCENARIO: Record<CategoriaEscenario, string> = {
  fisiologia: 'Fisiología', conducta: 'Conducta y factores humanos', radiacion: 'Radiación', entorno: 'Entorno', sistema: 'Sistema y autonomía',
};

export interface Escenario {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: CategoriaEscenario;
  hrp: IdRiesgoHRP[];
  peligros: Peligro[];
  /** Para la insignia de la tarjeta. */
  nivelMaximo: Nivel;
  /** Dos a cuatro puntos para quien presenta. */
  queObservar: string[];
  /** Astronauta sugerido (AST-01…). */
  perfil?: string;
  contextoInicial?: Partial<Contexto>;
  /** Historia hacia atrás (en días reales), cargada sin hablar. */
  precarga?: (t: number, p: Perfil) => Lectura[];
  pasos: PasoEscenario[];
  /** Por defecto true: el escenario empieza con un núcleo limpio. */
  reiniciar?: boolean;
}

export const L = (sensor: TipoSensor, valor: number, timestamp: number): Lectura => ({ sensor, valor, timestamp, fuente: 'simulador' });

/** Serie de lecturas de un dato, la última en `t` y las anteriores cada `pasoMs` hacia atrás. */
export function serie(sensor: TipoSensor, valores: number[], t: number, pasoMs = DIA): Lectura[] {
  return valores.map((v, i) => L(sensor, v, t - (valores.length - 1 - i) * pasoMs));
}

/** Noches de sueño: la última es la de anoche (hace 2 h), las anteriores un día antes cada una. */
export const noches = (horas: number[], t: number) => serie('horasSueno', horas, t - 2 * HORA);

/** Duración total de un escenario (hasta el último paso). */
export const duracionMs = (e: Escenario) => e.pasos.at(-1)?.enMs ?? 0;

/** Contexto de partida del simulador (también el de la app al abrir). */
export const CONTEXTO_BASE: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: true, medicoABordo: false,
  conexionHabitat: false, conexionTierra: false,
  diaMision: 45, transicionGravedad: false,
};

/** Valores en rango para todos los datos: un día sin novedades para este astronauta. */
export function diaNormal(t: number, p: Perfil, h?: Historial): Lectura[] {
  const b = p.lineaBase;
  return [
    L('frecuenciaCardiaca', b.frecuenciaCardiaca ?? 64, t), L('presionSistolica', 118, t), L('presionDiastolica', 76, t),
    L('spo2', 98, t), L('temperatura', 36.7, t), L('estres', b.estres ?? 25, t), L('irregularidadRitmo', 1, t),
    L('animo', b.animo ?? 7, t), L('minutosEjercicio', 95, t), L('minutosResistencia', 40, t),
    ...noches([7.5, 7, 7.5], t),
    L('glucemia', 92, t), L('caloriasDia', p.requerimientoCalorico, t), L('hidratacion', 2300, t),
    L('pesoCorporal', b.pesoCorporal ?? 70, t), L('aceptabilidadComida', 7, t),
    L('horasTrabajo', 8, t), L('desfaseCircadiano', 0.5, t), L('cohesionEquipo', b.cohesionEquipo ?? 8, t),
    L('equilibrio', b.equilibrio ?? 90, t), L('fuerza', b.fuerza ?? 100, t), L('aptitudAerobica', b.aptitudAerobica ?? 40, t),
    L('agudezaVisual', b.agudezaVisual ?? 95, t), L('presionIntraocular', Math.min(b.presionIntraocular ?? 15, 20), t),
    L('grosorRetina', 3, t), L('flujoYugular', 1, t), L('asimetriaPantorrilla', 0.5, t),
    L('orientacion', 10, t), L('cognicion', b.cognicion ?? 85, t), L('tiempoReaccion', b.tiempoReaccion ?? 270, t),
    L('ppO2Cabina', 20.8, t), L('ruidoCabina', 45, t), L('cargaMicrobiana', 20, t), L('calcioUrinario', 180, t),
    L('dosisRadiacion', h?.ultima('dosisRadiacion')?.valor ?? 120, t),
  ];
}
