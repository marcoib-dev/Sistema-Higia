/**
 * SIMULADOR DE SENSORES — escenarios para la demo en vivo.
 * Cada escenario inyecta lecturas falsas y, si corresponde, cambia el contexto.
 */
import type { Historial } from '../../core/historial';
import type { Contexto, Lectura, TipoSensor } from '../../core/tipos';

export interface Escenario {
  id: string;
  nombre: string;
  descripcion: string;
  contexto?: Partial<Contexto>;
  lecturas: (ahora: number, h: Historial) => Lectura[];
}

const L = (sensor: TipoSensor, valor: number, timestamp: number): Lectura => ({ sensor, valor, timestamp, fuente: 'simulador' });

export const ESCENARIOS: Escenario[] = [
  {
    id: 'base', nombre: 'Día normal en el hábitat',
    descripcion: 'Todos los sensores en rango. Sirve también para volver a la normalidad.',
    contexto: { ubicacion: 'habitat', hora: 10, actividad: 'trabajo', climaEspacial: 'calmo' },
    lecturas: (t, h) => [
      L('frecuenciaCardiaca', 64, t), L('presionSistolica', 118, t), L('presionDiastolica', 76, t),
      L('spo2', 98, t), L('animo', 7, t), L('estres', 25, t), L('minutosEjercicio', 95, t),
      // tres noches registradas
      L('horasSueno', 7.5, t - 2), L('horasSueno', 7, t - 1), L('horasSueno', 7.5, t),
      L('dosisRadiacion', h.ultima('dosisRadiacion')?.valor ?? 120, t),
    ],
  },
  {
    id: 'eva-estres', nombre: 'EVA: golpe en la estación',
    descripcion: 'Sale a reparar y el estrés se dispara. Debe llegar una indicación breve por auricular.',
    contexto: { ubicacion: 'eva', hora: 10, actividad: 'trabajo' },
    lecturas: (t) => [L('frecuenciaCardiaca', 132, t), L('estres', 86, t), L('spo2', 96, t)],
  },
  {
    id: 'crisis', nombre: 'Crisis sin respuesta',
    descripcion: 'Hipoxia grave en EVA. No presiones "Estoy bien": a los 15 s Higia avisa al compañero o a la base.',
    contexto: { ubicacion: 'eva', hora: 10 },
    lecturas: (t) => [L('spo2', 82, t), L('frecuenciaCardiaca', 118, t)],
  },
  {
    id: 'ejercicio', nombre: 'Sesión de ejercicio',
    descripcion: 'Pulso de 125 lpm, pero en ejercicio: el contexto evita una falsa alarma.',
    contexto: { ubicacion: 'habitat', actividad: 'ejercicio' },
    lecturas: (t) => [L('frecuenciaCardiaca', 125, t), L('minutosEjercicio', 60, t)],
  },
  {
    id: 'animo', nombre: 'Descenso del ánimo',
    descripcion: 'Información sensible: nunca debe ir a la pantalla compartida.',
    contexto: { ubicacion: 'habitat' },
    lecturas: (t) => [L('animo', 3, t)],
  },
  {
    id: 'sueno', nombre: 'Tres noches durmiendo poco',
    descripcion: 'Déficit de sueño acumulado: es un aviso, no una alerta.',
    lecturas: (t) => [L('horasSueno', 5, t - 2), L('horasSueno', 5.5, t - 1), L('horasSueno', 4.5, t)],
  },
  {
    id: 'hipoxia', nombre: 'Hipoxia',
    descripcion: 'Saturación de oxígeno baja. Es alerta y requiere reporte.',
    lecturas: (t) => [L('spo2', 86, t), L('frecuenciaCardiaca', 104, t)],
  },
  {
    id: 'presion-baja', nombre: 'Presión baja',
    descripcion: 'Riesgo de desmayo (adaptación cardiovascular).',
    lecturas: (t) => [L('presionSistolica', 86, t), L('presionDiastolica', 56, t)],
  },
  {
    id: 'sin-ejercicio', nombre: 'Día sin ejercicio',
    descripcion: 'Lleva 20 de 90 minutos. Contramedida para huesos y músculos.',
    lecturas: (t) => [L('minutosEjercicio', 20, t)],
  },
  {
    id: 'tormenta', nombre: 'Tormenta solar',
    descripcion: 'Se activa el clima espacial de tormenta y la dosis sube de golpe: debe ir al refugio.',
    contexto: { climaEspacial: 'tormentaSolar' },
    lecturas: (t, h) => {
      const base = h.ultima('dosisRadiacion')?.valor ?? 120;
      return [L('dosisRadiacion', base, t - 30 * 60_000), L('dosisRadiacion', base + 2.5, t)];
    },
  },
  {
    id: 'golpe-cabeza-eva', nombre: 'EVA: golpe fuerte en la cabeza',
    descripcion: 'El casco registra 46 g. Alerta de posible traumatismo craneal y Higia empieza el chequeo de orientación.',
    contexto: { ubicacion: 'eva', actividad: 'trabajo' },
    lecturas: (t) => [L('impactoCabeza', 46, t), L('frecuenciaCardiaca', 112, t)],
  },
  {
    id: 'golpe-cabeza-leve', nombre: 'Golpe en la cabeza en el hábitat',
    descripcion: 'Golpe de 18 g contra una escotilla: aviso y chequeo de orientación. Si fallas preguntas, pasa a alerta.',
    contexto: { ubicacion: 'habitat' },
    lecturas: (t) => [L('impactoCabeza', 18, t)],
  },
  {
    id: 'desorientacion', nombre: 'Desorientación y lentitud',
    descripcion: 'Tras noches cortas: orientación 6/10, prueba cognitiva y tiempo de reacción peores que su línea base.',
    contexto: { ubicacion: 'habitat' },
    lecturas: (t) => [
      L('horasSueno', 4.5, t - 2), L('horasSueno', 5, t - 1), L('horasSueno', 4, t),
      L('orientacion', 6, t), L('cognicion', 66, t), L('tiempoReaccion', 390, t),
    ],
  },
  {
    id: 'percepcion', nombre: 'Señales de alteración de la percepción',
    descripcion: 'Dice oír voces, con poco sueño y estrés alto: alerta sensible de posibles síntomas psicóticos.',
    contexto: { ubicacion: 'habitat' },
    lecturas: (t) => [
      L('horasSueno', 4, t - 2), L('horasSueno', 3.5, t - 1), L('horasSueno', 4, t),
      L('estres', 82, t), L('marcadoresPsicoticos', 5, t),
    ],
  },
  {
    id: 'madrugada', nombre: 'Aviso de madrugada',
    descripcion: 'Son las 3:00: el aviso se retiene. Cambia la hora a 8 para entregarlo.',
    contexto: { hora: 3, ubicacion: 'habitat' },
    lecturas: (t) => [L('presionSistolica', 145, t), L('presionDiastolica', 88, t)],
  },
];
