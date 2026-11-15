import { diaNormal, L, noches, type Escenario } from './modelo';

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
    id: 'dia-200', nombre: 'Día 200: todo un poco', categoria: 'sistema',
    descripcion: 'Muchas señales leves a la vez: los peligros se potencian.',
    hrp: ['sueno', 'aptitud', 'nutricion', 'oseo', 'hipoxia', 'inmune'], peligros: ['gravedad', 'aislamiento', 'entorno'], nivelMaximo: 'info',
    queObservar: ['Nada es grave por sí solo: la figura se llena de amarillo claro.', 'Higia no habla por cada uno: es información, no alarma.'],
    contextoInicial: { destino: 'marte', diaMision: 200, hora: 20 },
    pasos: [{
      enMs: 0, titulo: 'Un día cualquiera en el día 200', narracion: 'Sueño algo corto, fuerza y peso un poco más bajos, poca agua, oxígeno y temperatura apenas fuera.',
      lecturas: (t) => [
        ...noches([6.5, 6.5, 6.5], t), L('fuerza', 82, t), L('pesoCorporal', 60, t), L('hidratacion', 1300, t),
        L('spo2', 94, t), L('temperatura', 37.6, t), L('minutosResistencia', 40, t),
      ],
      sinHallazgosSobre: 'info',
      esperado: [
        { riesgoId: 'sueno.deficit', nivel: 'info' }, { riesgoId: 'musculo.aptitud', nivel: 'info' }, { riesgoId: 'nutricion.peso', nivel: 'info' },
        { riesgoId: 'nutricion.hidratacion', nivel: 'info' }, { riesgoId: 'pulmones.spo2', nivel: 'info' }, { riesgoId: 'inmune.fiebre', nivel: 'info' },
        { riesgoId: 'hueso.perdida', nivel: 'info' },
      ],
    }],
  },
];
