import type { Perfil } from '../../core/tipos';

/** Perfiles ficticios para la demo. */
export const PERFILES: Perfil[] = [
  {
    id: 'AST-01', nombre: 'Ana Ruiz', rol: 'Médica de la tripulación',
    formacionMedica: 'medico', experiencia: 'veterano', toleranciaEstres: 'alta', propensoPanico: false,
    lineaBase: { frecuenciaCardiaca: 58, animo: 7, estres: 25 },
    horarioSueno: { inicio: 23, fin: 7 },
  },
  {
    id: 'AST-02', nombre: 'Luis Pérez', rol: 'Ingeniero de sistemas',
    formacionMedica: 'ninguna', experiencia: 'novato', toleranciaEstres: 'baja', propensoPanico: true,
    lineaBase: { frecuenciaCardiaca: 70, animo: 7, estres: 35 },
    horarioSueno: { inicio: 22, fin: 6 },
  },
  {
    id: 'AST-03', nombre: 'Kai Tanaka', rol: 'Piloto (aviación experimental)',
    formacionMedica: 'basica', experiencia: 'intermedio', toleranciaEstres: 'alta', propensoPanico: false,
    lineaBase: { frecuenciaCardiaca: 62, animo: 8, estres: 30 },
    horarioSueno: { inicio: 23, fin: 7 },
  },
];
