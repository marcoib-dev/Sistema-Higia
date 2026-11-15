import { L, type Escenario } from './modelo';

/** Escenarios de fisiología (cuerpo y signos vitales). */
export const ESCENARIOS_FISIOLOGIA: Escenario[] = [
  {
    id: 'crisis', nombre: 'Crisis sin respuesta', categoria: 'fisiologia',
    descripcion: 'Hipoxia grave en EVA. No presiones "Estoy bien": a los 15 s Higia avisa al compañero o a la base.',
    hrp: ['hipoxia', 'eva'], peligros: ['entorno'], nivelMaximo: 'alerta',
    queObservar: ['La alerta pide confirmación con cuenta regresiva.', 'Higia avisa por voz antes de escalar.', 'Sin respuesta, escala al compañero con la historia clínica.'],
    perfil: 'AST-02',
    contextoInicial: { ubicacion: 'eva', hora: 10, companeroCercano: true },
    pasos: [
      {
        enMs: 0, titulo: 'Cae el oxígeno', narracion: 'La saturación baja a 82 % durante la EVA.',
        lecturas: (t) => [L('spo2', 82, t), L('frecuenciaCardiaca', 118, t)],
        esperado: [{ riesgoId: 'pulmones.spo2', nivel: 'alerta' }],
      },
      {
        enMs: 3_000, titulo: 'No respondas', narracion: 'El astronauta no puede responder. Espera a que Higia escale.',
        esperaEscalada: true,
      },
    ],
  },
  {
    id: 'ejercicio', nombre: 'Sesión de ejercicio', categoria: 'fisiologia',
    descripcion: 'Pulso de 125 lpm, pero en ejercicio: el contexto evita una falsa alarma.',
    hrp: ['cardiovascular', 'aptitud'], peligros: ['gravedad'], nivelMaximo: 'info',
    queObservar: ['Con el mismo pulso en reposo habría un aviso.', 'El ejercicio del día todavía no llega a la meta.'],
    contextoInicial: { ubicacion: 'habitat', actividad: 'ejercicio' },
    pasos: [{
      enMs: 0, titulo: 'Entrenando', narracion: 'Pulso de 125 lpm en la cinta: es esperable.',
      lecturas: (t) => [L('frecuenciaCardiaca', 125, t), L('minutosEjercicio', 60, t)],
      esperado: [{ riesgoId: 'cardio.frecuencia', nivel: 'normal' }, { riesgoId: 'musculo.ejercicio', nivel: 'info' }],
    }],
  },
  {
    id: 'hipoxia', nombre: 'Hipoxia', categoria: 'fisiologia',
    descripcion: 'Saturación de oxígeno baja. Es alerta y requiere reporte.',
    hrp: ['hipoxia'], peligros: ['entorno'], nivelMaximo: 'alerta',
    queObservar: ['Alerta con guía paso a paso si no hay médico a bordo.', 'Contraindica EVA y pilotaje.'],
    pasos: [{
      enMs: 0, titulo: 'Oxígeno bajo', narracion: 'SpO₂ 86 % en el hábitat, con el pulso acelerado.',
      lecturas: (t) => [L('spo2', 86, t), L('frecuenciaCardiaca', 104, t)],
      esperado: [{ riesgoId: 'pulmones.spo2', nivel: 'alerta' }],
    }],
  },
  {
    id: 'presion-baja', nombre: 'Presión baja', categoria: 'fisiologia',
    descripcion: 'Riesgo de desmayo (adaptación cardiovascular).',
    hrp: ['cardiovascular'], peligros: ['gravedad'], nivelMaximo: 'aviso',
    queObservar: ['Aviso con contramedidas: hidratación y prendas de compresión.'],
    pasos: [{
      enMs: 0, titulo: 'Presión de 86/56', narracion: 'La presión arterial está baja.',
      lecturas: (t) => [L('presionSistolica', 86, t), L('presionDiastolica', 56, t)],
      esperado: [{ riesgoId: 'cardio.presion', nivel: 'aviso' }],
    }],
  },
  {
    id: 'sin-ejercicio', nombre: 'Día sin ejercicio', categoria: 'fisiologia',
    descripcion: 'Lleva 20 de 90 minutos. Contramedida para huesos y músculos.',
    hrp: ['aptitud', 'oseo'], peligros: ['gravedad'], nivelMaximo: 'aviso',
    queObservar: ['Aviso de autogestión: no se reporta a nadie.'],
    pasos: [{
      enMs: 0, titulo: '20 de 90 minutos', narracion: 'El día avanza y casi no hubo ejercicio.',
      lecturas: (t) => [L('minutosEjercicio', 20, t)],
      esperado: [{ riesgoId: 'musculo.ejercicio', nivel: 'aviso' }],
    }],
  },
  {
    id: 'golpe-cabeza-eva', nombre: 'EVA: golpe fuerte en la cabeza', categoria: 'fisiologia',
    descripcion: 'El casco registra 46 g. Alerta de posible traumatismo craneal y Higia empieza el chequeo de orientación.',
    hrp: ['cargasDinamicas', 'eva'], peligros: ['entorno', 'gravedad'], nivelMaximo: 'alerta',
    queObservar: ['El cráneo se marca en la figura.', 'Higia inicia sola el chequeo de orientación.', 'La acción cambia por estar en EVA.'],
    contextoInicial: { ubicacion: 'eva', actividad: 'trabajo' },
    pasos: [{
      enMs: 0, titulo: 'Golpe de 46 g', narracion: 'El acelerómetro del casco registra un golpe fuerte.',
      lecturas: (t) => [L('impactoCabeza', 46, t), L('frecuenciaCardiaca', 112, t)],
      esperado: [{ riesgoId: 'trauma.craneal', nivel: 'alerta' }],
    }],
  },
  {
    id: 'golpe-cabeza-leve', nombre: 'Golpe en la cabeza en el hábitat', categoria: 'fisiologia',
    descripcion: 'Golpe de 18 g contra una escotilla: aviso y chequeo de orientación. Si falla preguntas, pasa a alerta.',
    hrp: ['cargasDinamicas'], peligros: ['entorno'], nivelMaximo: 'alerta',
    queObservar: ['Primero es un aviso.', 'Con la orientación alterada después del golpe, sube a alerta.'],
    contextoInicial: { ubicacion: 'habitat' },
    pasos: [
      {
        enMs: 0, titulo: 'Golpe contra la escotilla', narracion: 'Golpe de 18 g: Higia pide un chequeo de orientación.',
        lecturas: (t) => [L('impactoCabeza', 18, t)],
        esperado: [{ riesgoId: 'trauma.craneal', nivel: 'aviso' }],
      },
      {
        enMs: 10_000, titulo: 'Falla preguntas de orientación', narracion: 'Responde bien solo 6 de 10: el golpe pudo afectarlo.',
        lecturas: (t) => [L('orientacion', 6, t)],
        esperado: [{ riesgoId: 'trauma.craneal', nivel: 'alerta' }, { riesgoId: 'mental.orientacion', nivel: 'aviso' }],
      },
    ],
  },
];
