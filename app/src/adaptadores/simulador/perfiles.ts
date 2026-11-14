import type { Perfil } from '../../core/tipos';

/** Perfiles ficticios para la demo, cada uno con su historia clínica previa a la misión. */
export const PERFILES: Perfil[] = [
  {
    id: 'AST-01', nombre: 'Ana Ruiz', rol: 'Médica de la tripulación',
    formacionMedica: 'medico', experiencia: 'veterano', toleranciaEstres: 'alta', propensoPanico: false,
    lineaBase: {
      frecuenciaCardiaca: 58, animo: 7, estres: 25, cognicion: 90, tiempoReaccion: 255,
      fuerza: 92, aptitudAerobica: 38, equilibrio: 88, agudezaVisual: 95, pesoCorporal: 62, cohesionEquipo: 8, presionIntraocular: 15,
    },
    requerimientoCalorico: 2200,
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
    lineaBase: {
      frecuenciaCardiaca: 70, animo: 7, estres: 35, cognicion: 84, tiempoReaccion: 285,
      fuerza: 100, aptitudAerobica: 45, equilibrio: 90, agudezaVisual: 98, pesoCorporal: 78, cohesionEquipo: 8, presionIntraocular: 14,
    },
    requerimientoCalorico: 2800,
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
    lineaBase: {
      frecuenciaCardiaca: 62, animo: 8, estres: 30, cognicion: 88, tiempoReaccion: 240,
      fuerza: 105, aptitudAerobica: 48, equilibrio: 94, agudezaVisual: 99, pesoCorporal: 74, cohesionEquipo: 9, presionIntraocular: 16,
    },
    requerimientoCalorico: 2700,
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
  {
    id: 'AST-04', nombre: 'Irene Novak', rol: 'Comandante',
    formacionMedica: 'basica', experiencia: 'veterano', toleranciaEstres: 'alta', propensoPanico: false,
    lineaBase: {
      frecuenciaCardiaca: 60, animo: 7, estres: 28, cognicion: 87, tiempoReaccion: 265,
      fuerza: 85, aptitudAerobica: 34, equilibrio: 85, agudezaVisual: 90, pesoCorporal: 66, cohesionEquipo: 8, presionIntraocular: 21,
    },
    requerimientoCalorico: 2100,
    horarioSueno: { inicio: 22, fin: 6 },
    historiaClinica: {
      edad: 52, sexo: 'femenino', grupoSanguineo: 'A−',
      alergias: ['Sulfamidas'],
      antecedentes: [
        { nombre: 'Presión intraocular en el límite alto', sistema: 'ojos', detalle: '21 mmHg antes del vuelo; nervio óptico sin daño' },
      ],
      medicacion: ['Omega-3'],
      cirugias: [],
      antecedentesFamiliares: ['Infarto de miocardio (padre, a los 58 años)'],
      notas: ['Cuarta misión; comandante', 'Formación en primeros auxilios avanzados'],
    },
  },
];
