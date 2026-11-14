import type { Perfil } from '../../core/tipos';

/** Perfiles ficticios para la demo, cada uno con su historia clínica previa a la misión. */
export const PERFILES: Perfil[] = [
  {
    id: 'AST-01', nombre: 'Ana Ruiz', rol: 'Médica de la tripulación',
    formacionMedica: 'medico', experiencia: 'veterano', toleranciaEstres: 'alta', propensoPanico: false,
    lineaBase: { frecuenciaCardiaca: 58, animo: 7, estres: 25, cognicion: 90, tiempoReaccion: 255 },
    horarioSueno: { inicio: 23, fin: 7 },
    historiaClinica: {
      edad: 46, sexo: 'femenino', grupoSanguineo: 'O+',
      alergias: ['Penicilina'],
      antecedentes: [
        { nombre: 'Osteopenia leve', sistema: 'huesos', detalle: 'Densitometría previa a la misión: T-score −1,3' },
        { nombre: 'Migraña ocasional', sistema: 'cerebro', detalle: 'Sin aura; 1–2 episodios al año' },
      ],
      medicacion: ['Vitamina D 2000 UI diaria'],
      cirugias: ['Apendicectomía (2004)'],
      antecedentesFamiliares: ['Osteoporosis (madre)'],
      notas: ['Tercera misión de larga duración', 'Vacunación completa'],
    },
  },
  {
    id: 'AST-02', nombre: 'Luis Pérez', rol: 'Ingeniero de sistemas',
    formacionMedica: 'ninguna', experiencia: 'novato', toleranciaEstres: 'baja', propensoPanico: true,
    lineaBase: { frecuenciaCardiaca: 70, animo: 7, estres: 35, cognicion: 84, tiempoReaccion: 285 },
    horarioSueno: { inicio: 22, fin: 6 },
    historiaClinica: {
      edad: 34, sexo: 'masculino', grupoSanguineo: 'A+',
      alergias: [],
      antecedentes: [
        { nombre: 'Trastorno de pánico (en remisión)', sistema: 'cerebro', detalle: 'Último episodio hace 3 años; seguimiento psicológico' },
        { nombre: 'Asma leve en la infancia', sistema: 'pulmones', detalle: 'Sin crisis desde los 12 años' },
      ],
      medicacion: [],
      cirugias: [],
      antecedentesFamiliares: ['Hipertensión (padre)'],
      notas: ['Primera misión', 'Entrenado en técnicas de respiración para el pánico'],
    },
  },
  {
    id: 'AST-03', nombre: 'Kai Tanaka', rol: 'Piloto (aviación experimental)',
    formacionMedica: 'basica', experiencia: 'intermedio', toleranciaEstres: 'alta', propensoPanico: false,
    lineaBase: { frecuenciaCardiaca: 62, animo: 8, estres: 30, cognicion: 88, tiempoReaccion: 240 },
    horarioSueno: { inicio: 23, fin: 7 },
    historiaClinica: {
      edad: 39, sexo: 'masculino', grupoSanguineo: 'B−',
      alergias: ['Ibuprofeno', 'Látex'],
      antecedentes: [
        { nombre: 'Hipertensión arterial leve', sistema: 'corazon', detalle: 'Controlada con medicación desde 2021' },
        { nombre: 'Fractura de tibia izquierda', sistema: 'piernas', detalle: 'Consolidada (2015)' },
      ],
      medicacion: ['Losartán 50 mg diario'],
      cirugias: ['Osteosíntesis de tibia (2015)'],
      antecedentesFamiliares: ['Diabetes tipo 2 (madre)'],
      notas: ['Segunda misión', 'Formación en primeros auxilios'],
    },
  },
];
