import { L, noches, type Escenario } from './modelo';

/** Escenarios de conducta y factores humanos (salud mental, sueño, cognición). */
export const ESCENARIOS_CONDUCTA: Escenario[] = [
  {
    id: 'eva-estres', nombre: 'EVA: golpe en la estación', categoria: 'conducta',
    descripcion: 'Sale a reparar y el estrés se dispara. Debe llegar una indicación breve por auricular.',
    hrp: ['conductual', 'eva'], peligros: ['aislamiento', 'entorno'], nivelMaximo: 'alerta',
    queObservar: ['Mensaje breve por auricular, con la acción del arnés.', 'A quien es propenso al pánico no se le nombra el pánico.'],
    perfil: 'AST-02',
    contextoInicial: { ubicacion: 'eva', hora: 10, actividad: 'trabajo' },
    pasos: [{
      enMs: 0, titulo: 'Se dispara el estrés', narracion: 'Un golpe en la estructura: pulso alto y estrés de 86.',
      lecturas: (t) => [L('frecuenciaCardiaca', 132, t), L('estres', 86, t), L('spo2', 96, t)],
      esperado: [{ riesgoId: 'mental.estres', nivel: 'alerta' }, { riesgoId: 'cardio.frecuencia', nivel: 'aviso' }],
    }],
  },
  {
    id: 'animo', nombre: 'Descenso del ánimo', categoria: 'conducta',
    descripcion: 'Información sensible: nunca debe ir a la pantalla compartida.',
    hrp: ['conductual'], peligros: ['aislamiento'], nivelMaximo: 'alerta',
    queObservar: ['El mensaje va a la pantalla personal, no a la del hábitat.'],
    contextoInicial: { ubicacion: 'habitat' },
    pasos: [{
      enMs: 0, titulo: 'Ánimo 3 de 10', narracion: 'La encuesta de ánimo marca 3, lejos de su habitual 7.',
      lecturas: (t) => [L('animo', 3, t)],
      esperado: [{ riesgoId: 'mental.animo', nivel: 'alerta' }],
    }],
  },
  {
    id: 'sueno', nombre: 'Tres noches durmiendo poco', categoria: 'conducta',
    descripcion: 'Déficit de sueño acumulado: es un aviso, no una alerta.',
    hrp: ['sueno'], peligros: ['aislamiento', 'entorno'], nivelMaximo: 'aviso',
    queObservar: ['Se usa el promedio de tres noches, no una sola.'],
    pasos: [{
      enMs: 0, titulo: 'Promedio de 5 h', narracion: 'Tres noches de 5, 5,5 y 4,5 horas.',
      lecturas: (t) => noches([5, 5.5, 4.5], t),
      esperado: [{ riesgoId: 'sueno.deficit', nivel: 'aviso' }],
    }],
  },
  {
    id: 'desorientacion', nombre: 'Desorientación y lentitud', categoria: 'conducta',
    descripcion: 'Tras noches cortas: orientación 6/10, prueba cognitiva y tiempo de reacción peores que su línea base.',
    hrp: ['conductual', 'sueno'], peligros: ['aislamiento'], nivelMaximo: 'alerta',
    queObservar: ['Compara cada prueba con la línea base de la persona.', 'Es un dato sensible.'],
    contextoInicial: { ubicacion: 'habitat' },
    pasos: [{
      enMs: 0, titulo: 'Pruebas por debajo de lo habitual', narracion: 'Orientación 6/10, cognición 66 y reacción de 390 ms.',
      lecturas: (t) => [...noches([4.5, 5, 4], t), L('orientacion', 6, t), L('cognicion', 66, t), L('tiempoReaccion', 390, t)],
      esperado: [{ riesgoId: 'mental.orientacion', nivel: 'alerta' }, { riesgoId: 'sueno.deficit', nivel: 'aviso' }],
    }],
  },
  {
    id: 'percepcion', nombre: 'Señales de alteración de la percepción', categoria: 'conducta',
    descripcion: 'Dice oír voces, con poco sueño y estrés alto: alerta sensible de posibles síntomas psicóticos.',
    hrp: ['conductual', 'sueno'], peligros: ['aislamiento', 'distancia'], nivelMaximo: 'alerta',
    queObservar: ['Higia no discute ni diagnostica: busca compañía y avisa al médico.', 'Los factores de riesgo quedan en el detalle.'],
    contextoInicial: { ubicacion: 'habitat' },
    pasos: [{
      enMs: 0, titulo: 'Oye voces', narracion: 'Tras noches de 4 h y estrés alto, cuenta que oye voces.',
      lecturas: (t) => [...noches([4, 3.5, 4], t), L('estres', 82, t), L('marcadoresPsicoticos', 5, t)],
      esperado: [{ riesgoId: 'mental.psicosis', nivel: 'alerta' }],
    }],
  },
];
