import { diaNormal, L, type Escenario } from './modelo';

/** Escenarios del sistema: día normal, entrega diferida y autonomía. */
export const ESCENARIOS_SISTEMA: Escenario[] = [
  {
    id: 'base', nombre: 'Día normal en el hábitat', categoria: 'sistema',
    descripcion: 'Todos los datos en rango. Sirve también para volver a la normalidad.',
    hrp: [], peligros: [], nivelMaximo: 'normal',
    queObservar: ['La figura queda en verde: con 36 reglas activas, un día normal no dispara nada.', 'Cada sistema muestra en qué datos se basa.'],
    contextoInicial: { ubicacion: 'habitat', hora: 10, actividad: 'trabajo', climaEspacial: 'calmo' },
    pasos: [{
      enMs: 0, titulo: 'Un día sin novedades', narracion: 'Llegan los datos de todos los sensores, pruebas y encuestas, todos en rango.',
      lecturas: (t, h, p) => diaNormal(t, p, h),
      sinHallazgosSobre: 'info',
      esperado: [{ riesgoId: 'cardio.frecuencia', nivel: 'normal' }, { riesgoId: 'sans.vision', nivel: 'normal' }],
    }],
  },
  {
    id: 'madrugada', nombre: 'Aviso de madrugada', categoria: 'sistema',
    descripcion: 'A las 3:00 un aviso se retiene para no despertar; se entrega al despertar.',
    hrp: ['cardiovascular', 'sueno'], peligros: ['aislamiento'], nivelMaximo: 'aviso',
    queObservar: ['El aviso queda retenido (no suena).', 'A las 8:00 se entrega solo, con el motivo de la demora.'],
    contextoInicial: { hora: 3, ubicacion: 'habitat' },
    pasos: [
      {
        enMs: 0, titulo: 'Presión algo alta a las 3:00', narracion: 'Es de madrugada: un aviso que no es urgente se guarda para no despertar.',
        lecturas: (t) => [L('presionSistolica', 145, t), L('presionDiastolica', 88, t)],
        esperado: [{ riesgoId: 'cardio.presion', nivel: 'aviso' }],
      },
      {
        enMs: 8_000, titulo: 'Amanece', narracion: 'Son las 8:00: Higia entrega lo que había retenido.',
        contexto: { hora: 8 },
        esperado: [{ riesgoId: 'cardio.presion', nivel: 'aviso' }],
      },
    ],
  },
];
