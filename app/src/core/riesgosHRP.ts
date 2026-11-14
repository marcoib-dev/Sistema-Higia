/**
 * CATÁLOGO DE RIESGOS DEL HRP (Human Research Program de la NASA).
 * Los 17 riesgos de §7 del documento del desafío, más el tromboembolismo venoso (§8.2, Venous Haemostasis).
 * Cada regla declara a qué riesgos responde (`Regla.hrp`): la matriz de cobertura sale de estos datos.
 */
import type { SistemaCorporal } from './tipos';

/** Los cinco peligros del vuelo espacial (Anexo A). */
export type Peligro = 'radiacion' | 'aislamiento' | 'distancia' | 'gravedad' | 'entorno';

export const PELIGROS: Peligro[] = ['radiacion', 'aislamiento', 'distancia', 'gravedad', 'entorno'];

export const NOMBRE_PELIGRO: Record<Peligro, string> = {
  radiacion: 'Radiación espacial',
  aislamiento: 'Aislamiento y confinamiento',
  distancia: 'Distancia de la Tierra',
  gravedad: 'Campos de gravedad',
  entorno: 'Entornos cerrados u hostiles',
};

export type IdRiesgoHRP =
  | 'inmune' | 'sensoriomotor' | 'cardiovascular' | 'descompresion' | 'microorganismos' | 'hipoxia'
  | 'nutricion' | 'eva' | 'aptitud' | 'sans' | 'oseo'
  | 'conductual' | 'equipo' | 'sueno' | 'sistemas' | 'cargasDinamicas'
  | 'radiacion' | 'trombosis';

export interface RiesgoHRP {
  id: IdRiesgoHRP;
  nombre: string;
  categoria: 'fisiologia' | 'conducta' | 'radiacion';
  /** Sección del documento del desafío ('7.1.3'). */
  seccion: string;
  peligros: Peligro[];
  sistemas: SistemaCorporal[];
  /** Una oración, en lenguaje simple. */
  resumen: string;
  /** Página de la NASA (§15 del documento). */
  url: string;
}

const REF = 'https://www.nasa.gov/reference/';

export const RIESGOS_HRP: RiesgoHRP[] = [
  {
    id: 'inmune', nombre: 'Respuesta inmune alterada', categoria: 'fisiologia', seccion: '7.1.1',
    peligros: ['radiacion', 'aislamiento', 'gravedad', 'entorno'], sistemas: ['inmune'],
    resumen: 'El estrés, el mal sueño y la radiación alteran las defensas: infecciones, alergias y virus latentes que despiertan.',
    url: `${REF}risk-of-altered-immune-system-responses/`,
  },
  {
    id: 'sensoriomotor', nombre: 'Función sensoriomotora y vestibular alterada', categoria: 'fisiologia', seccion: '7.1.2',
    peligros: ['gravedad'], sistemas: ['oidoInterno', 'cerebro'],
    resumen: 'Los cambios de gravedad provocan mareo y desorientación que afectan las tareas y el manejo de vehículos.',
    url: `${REF}risk-of-altered-sensorimotor-and-vestibular-function/`,
  },
  {
    id: 'cardiovascular', nombre: 'Adaptaciones cardiovasculares', categoria: 'fisiologia', seccion: '7.1.3',
    peligros: ['gravedad', 'radiacion'], sistemas: ['corazon', 'piernas'],
    resumen: 'La baja gravedad cambia el corazón y los vasos: arritmias, coágulos y presión baja al aterrizar.',
    url: `${REF}risk-of-cardiovascular-adaptations/`,
  },
  {
    id: 'descompresion', nombre: 'Enfermedad por descompresión', categoria: 'fisiologia', seccion: '7.1.4',
    peligros: ['entorno'], sistemas: ['cuerpo', 'pulmones'],
    resumen: 'Al pasar a la baja presión del traje, el nitrógeno forma burbujas: dolor articular y, en casos graves, síntomas de ACV.',
    url: `${REF}risk-of-decompression-sickness/`,
  },
  {
    id: 'microorganismos', nombre: 'Interacción huésped-microorganismos', categoria: 'fisiologia', seccion: '7.1.5',
    peligros: ['entorno', 'aislamiento'], sistemas: ['intestino', 'inmune'],
    resumen: 'Cambia el microbioma de la piel y el intestino, y algunos microbios se vuelven más agresivos en el espacio.',
    url: `${REF}risk-of-host-microorganism-interactions/`,
  },
  {
    id: 'hipoxia', nombre: 'Hipoxia', categoria: 'fisiologia', seccion: '7.1.6',
    peligros: ['entorno'], sistemas: ['pulmones', 'cerebro'],
    resumen: 'Las cabinas parcialmente despresurizadas pueden dar hipoxia leve: dolor de cabeza, confusión, visión alterada y mal sueño.',
    url: `${REF}risk-of-hypoxia/`,
  },
  {
    id: 'nutricion', nombre: 'Alimentación y nutrición inadecuadas', categoria: 'fisiologia', seccion: '7.1.7',
    peligros: ['distancia', 'entorno'], sistemas: ['metabolismo', 'intestino'],
    resumen: 'La fatiga de menú hace comer menos: pérdida de peso y deficiencias, sin reabastecimiento.',
    url: `${REF}risk-of-inadequate-food-and-nutrition/`,
  },
  {
    id: 'eva', nombre: 'Lesiones y rendimiento en caminatas espaciales', categoria: 'fisiologia', seccion: '7.1.8',
    peligros: ['entorno', 'gravedad'], sistemas: ['musculos', 'cuerpo'],
    resumen: 'Las EVA serán más largas y frecuentes: sobreesfuerzo, calor en el traje y lesiones.',
    url: `${REF}risk-of-injury-and-compromised-performance-from-extravehicular-activity-eva/`,
  },
  {
    id: 'aptitud', nombre: 'Menor aptitud cardiorrespiratoria y musculoesquelética', categoria: 'fisiologia', seccion: '7.1.9',
    peligros: ['gravedad'], sistemas: ['musculos', 'pulmones'],
    resumen: 'Se pierde en promedio un 10–12 % de fuerza y aptitud aeróbica; entre el 12 y el 38 % pierde más del 20 %.',
    url: `${REF}risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/`,
  },
  {
    id: 'sans', nombre: 'Síndrome neuro-ocular (SANS)', categoria: 'fisiologia', seccion: '7.1.10',
    peligros: ['gravedad'], sistemas: ['ojos', 'cerebro'],
    resumen: 'Los fluidos suben a la cabeza e hinchan el fondo del ojo: cerca del 70 % tiene algún cambio.',
    url: `${REF}risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/`,
  },
  {
    id: 'oseo', nombre: 'Cambios óseos', categoria: 'fisiologia', seccion: '7.1.11',
    peligros: ['gravedad'], sistemas: ['huesos'],
    resumen: 'Columna y caderas pierden entre 1 y 1,5 % de densidad por mes: más riesgo de fractura.',
    url: `${REF}risk-of-spaceflight-induced-bone-changes/`,
  },
  {
    id: 'conductual', nombre: 'Cambios conductuales y trastornos psiquiátricos', categoria: 'conducta', seccion: '7.2.1',
    peligros: ['aislamiento', 'distancia'], sistemas: ['cerebro'],
    resumen: 'El aislamiento prolongado aumenta la ansiedad y la depresión, que afectan el sueño y las decisiones.',
    url: `${REF}risk-of-behavioral-conditions-and-psychiatric-disorders/`,
  },
  {
    id: 'equipo', nombre: 'Trabajo en equipo inadecuado', categoria: 'conducta', seccion: '7.2.2',
    peligros: ['aislamiento', 'distancia'], sistemas: ['cerebro'],
    resumen: 'Lejos de la Tierra y en poco espacio, los conflictos del equipo hay que resolverlos a bordo.',
    url: `${REF}risk-of-inadequate-teamwork/`,
  },
  {
    id: 'sueno', nombre: 'Sueño inadecuado y horarios irregulares', categoria: 'conducta', seccion: '7.2.3',
    peligros: ['aislamiento', 'entorno'], sistemas: ['cerebro'],
    resumen: 'Sobrecarga de trabajo, luz irregular y ruido alteran el sueño y el reloj biológico.',
    url: `${REF}risk-from-inadequate-sleep-and-irregular-schedules/`,
  },
  {
    id: 'sistemas', nombre: 'Soporte inadecuado para operar sistemas', categoria: 'conducta', seccion: '7.2.4',
    peligros: ['distancia'], sistemas: ['cerebro'],
    resumen: 'Lejos de la Tierra hay que resolver los problemas sin control de misión: la herramienta debe guiar sola.',
    url: `${REF}risk-of-inadequate-systems-operations-support/`,
  },
  {
    id: 'cargasDinamicas', nombre: 'Lesiones por cargas dinámicas', categoria: 'conducta', seccion: '7.2.5',
    peligros: ['gravedad'], sistemas: ['huesos', 'cerebro'],
    resumen: 'Aterrizajes y transiciones de gravedad con huesos debilitados: golpes y lesiones de columna.',
    url: `${REF}risk-of-injury-from-dynamic-loads/`,
  },
  {
    id: 'radiacion', nombre: 'Cánceres inducidos por radiación', categoria: 'radiacion', seccion: '7.3.1',
    peligros: ['radiacion', 'distancia'], sistemas: ['cuerpo'],
    resumen: 'Fuera de la magnetosfera la radiación es mayor: riesgo de cáncer y daño en corazón, ojos y sistema nervioso.',
    url: `${REF}risk-of-radiation-induced-cancers/`,
  },
  {
    id: 'trombosis', nombre: 'Tromboembolismo venoso', categoria: 'fisiologia', seccion: '8.2',
    peligros: ['gravedad'], sistemas: ['piernas', 'corazon'],
    resumen: 'El flujo venoso cambia en microgravedad y algunos astronautas forman coágulos, sobre todo en la yugular.',
    url: `${REF}venous-haemostasis/`,
  },
];

export const IDS_HRP: IdRiesgoHRP[] = RIESGOS_HRP.map((r) => r.id);

export const RIESGO_HRP: Record<IdRiesgoHRP, RiesgoHRP> =
  Object.fromEntries(RIESGOS_HRP.map((r) => [r.id, r])) as Record<IdRiesgoHRP, RiesgoHRP>;
