import { DIA, L, noches, serie, type Escenario } from './modelo';

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
  {
    id: 'animo-sostenido', nombre: 'Diez días grises camino a Marte', categoria: 'conducta',
    descripcion: 'Lleva días con el ánimo bajo, sin enlace con Tierra.',
    hrp: ['conductual'], peligros: ['aislamiento', 'distancia'], nivelMaximo: 'alerta',
    queObservar: ['Mira la tendencia de dos semanas, no un día malo.', 'Sin enlace con Tierra no promete una llamada: propone autocuidado a bordo.', 'Nunca va a la pantalla compartida.'],
    contextoInicial: { destino: 'marte', diaMision: 210, conexionTierra: false },
    precarga: (t) => serie('animo', Array(9).fill(4), t - DIA),
    pasos: [{
      enMs: 0, titulo: 'Otro día gris', narracion: 'La encuesta de hoy vuelve a dar 4 de 10: son diez días.',
      lecturas: (t) => [L('animo', 4, t)],
      esperado: [{ riesgoId: 'mental.animoSostenido', nivel: 'alerta' }],
    }],
  },
  {
    id: 'conflicto', nombre: 'Tensión en la tripulación', categoria: 'conducta',
    descripcion: 'La encuesta de convivencia baja en tres días.',
    hrp: ['equipo'], peligros: ['aislamiento', 'distancia'], nivelMaximo: 'alerta',
    queObservar: ['Es un dato sensible: va por el canal privado.', 'Propone una conversación guiada, no culpables.'],
    pasos: [
      { enMs: 0, titulo: 'Convivencia bien', narracion: 'Cohesión 8 de 10.', lecturas: (t) => [L('cohesionEquipo', 8, t)], esperado: [{ riesgoId: 'equipo.cohesion', nivel: 'normal' }] },
      { enMs: 8_000, titulo: 'Roces', narracion: 'Cohesión 5 de 10.', lecturas: (t) => [L('cohesionEquipo', 5, t)], esperado: [{ riesgoId: 'equipo.cohesion', nivel: 'aviso' }] },
      { enMs: 16_000, titulo: 'Conflicto abierto', narracion: 'Cohesión 3 de 10.', lecturas: (t) => [L('cohesionEquipo', 3, t)], esperado: [{ riesgoId: 'equipo.cohesion', nivel: 'alerta' }] },
    ],
  },
  {
    id: 'turnos', nombre: 'Semana de turnos corridos', categoria: 'conducta',
    descripcion: 'Reloj biológico corrido, jornadas de más de 12 h y poco sueño. Después, sube al rover.',
    hrp: ['sueno', 'conductual'], peligros: ['aislamiento', 'entorno'], nivelMaximo: 'alerta',
    queObservar: ['Tres hallazgos de sueño y horarios.', 'Con menos de 5 h de sueño, el pilotaje queda contraindicado.'],
    perfil: 'AST-03',
    precarga: (t) => [...serie('horasTrabajo', [12.5, 12.5, 12.5], t - DIA), ...noches([5.5, 5], t - DIA)],
    pasos: [
      { enMs: 0, titulo: 'Reloj corrido', narracion: 'La actigrafía muestra el sueño corrido 3 h.', lecturas: (t) => [L('desfaseCircadiano', 3, t)], esperado: [{ riesgoId: 'sueno.circadiano', nivel: 'aviso' }] },
      { enMs: 8_000, titulo: 'Cuarta jornada larga', narracion: 'Hoy trabajó 12,5 h, como los tres días anteriores.', lecturas: (t) => [L('horasTrabajo', 12.5, t)], esperado: [{ riesgoId: 'trabajo.sobrecarga', nivel: 'alerta' }] },
      { enMs: 16_000, titulo: 'Durmió cuatro horas', narracion: 'Lo cuenta en la conversación.', frase: 'dormí cuatro horas', esperado: [{ riesgoId: 'sueno.deficit', nivel: 'aviso' }] },
      { enMs: 24_000, titulo: 'Sube al rover', narracion: 'Va a manejar: el pilotaje está contraindicado.', contexto: { ubicacion: 'rover' }, esperado: [{ riesgoId: 'tarea.pilotaje', nivel: 'aviso' }] },
    ],
  },
];
