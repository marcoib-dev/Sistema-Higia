import { DIA, diaNormal, L, noches, serie, type Escenario } from './modelo';

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
  {
    id: 'autonomia', nombre: 'Emergencia sin nadie al alcance', categoria: 'sistema',
    descripcion: 'En Marte, sin médico, sin enlaces y sin compañero cerca: una arritmia grave y no responde.',
    hrp: ['sistemas', 'cardiovascular'], peligros: ['distancia', 'aislamiento'], nivelMaximo: 'alerta',
    queObservar: ['La guía paso a paso es lo único disponible (§7.2.4).', 'Sin nadie al alcance, se activa la baliza.', 'Todo corre en el dispositivo, sin red.'],
    perfil: 'AST-02',
    contextoInicial: { destino: 'marte', diaMision: 400, medicoABordo: false, conexionHabitat: false, conexionTierra: false, companeroCercano: false, actividad: 'reposo' },
    pasos: [
      {
        enMs: 0, titulo: 'Arritmia grave', narracion: '18 % de latidos irregulares con pulso de 130.',
        lecturas: (t) => [L('irregularidadRitmo', 18, t), L('frecuenciaCardiaca', 130, t)],
        esperado: [{ riesgoId: 'cardio.arritmia', nivel: 'alerta' }],
      },
      { enMs: 4_000, titulo: 'No responde', narracion: 'No toques "Estoy bien": no hay nadie a quien avisar, así que activa la baliza.', esperaEscalada: true },
    ],
  },
  {
    id: 'dia-200', nombre: 'Día 200: las señales se suman', categoria: 'sistema',
    descripcion: 'Dos semanas de mal sueño, el ánimo en baja, radiación y hueso: nada es grave solo, pero juntas desaconsejan la EVA.',
    hrp: ['sueno', 'conductual', 'radiacion', 'oseo'], peligros: ['aislamiento', 'radiacion', 'gravedad'], nivelMaximo: 'aviso',
    queObservar: [
      'Cada señal es leve, pero Higia las conecta: aparece "Varias señales leves se suman".',
      'En el Resumen, "Aptitud para tareas" marca la EVA como no recomendada.',
      'Al intentar salir a EVA, Higia avisa: no lo impide, lo advierte.',
    ],
    perfil: 'AST-04',
    contextoInicial: { destino: 'luna', diaMision: 200, hora: 7, ubicacion: 'habitat' },
    // Historia: 14 noches cortas, el ánimo que viene bajando, 60 % del límite de radiación y resistencia irregular.
    precarga: (t, p) => {
      const base = p.lineaBase.animo ?? 7;
      const animo = [base, base, base, base - 1, base, base, base - 1, base, base - 2, base, base - 2, base - 2, base - 2];
      return [
        ...noches([5.5, 5, 5.5, 5, 5.5, 5, 5, 5.5, 5, 5, 5.5, 5, 5, 5.5], t),
        ...serie('animo', animo, t - DIA),
        ...serie('dosisRadiacion', Array.from({ length: 14 }, (_, i) => 347 + i), t),
        ...serie('minutosResistencia', Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 40 : 15)), t),
      ];
    },
    pasos: [
      {
        enMs: 0, titulo: 'Encuesta de ánimo de la mañana', narracion: 'Otro día con el ánimo bajo: ya son cinco en la última semana. Ahora las señales se suman.',
        lecturas: (t, _h, p) => [L('animo', (p.lineaBase.animo ?? 7) - 2, t)],
        esperado: [
          { riesgoId: 'sueno.deficit', nivel: 'aviso' }, { riesgoId: 'mental.animoSostenido', nivel: 'aviso' },
          { riesgoId: 'radiacion.dosis', nivel: 'info' }, { riesgoId: 'hueso.perdida', nivel: 'info' },
          { riesgoId: 'sistema.senalesCombinadas', nivel: 'aviso' },
        ],
      },
      {
        enMs: 9_000, titulo: 'Se prepara para salir a EVA', narracion: 'Sale de la esclusa a pesar del aviso: Higia le recuerda que hoy no es recomendable.',
        contexto: { ubicacion: 'eva', actividad: 'trabajo' },
        esperado: [{ riesgoId: 'tarea.eva', nivel: 'aviso' }],
      },
    ],
  },
];
