/**
 * Datos de la matriz de cobertura: qué reglas y qué escenarios responden a cada riesgo HRP de la NASA.
 * Sale del catálogo (no se escribe a mano): si una regla nueva declara su `hrp`, aparece sola.
 */
import { ESCENARIOS, type Escenario } from '../../adaptadores/simulador/escenarios';
import { REGLAS } from '../../core/reglas';
import { IDS_HRP, PELIGROS, RIESGOS_HRP, type IdRiesgoHRP, type Peligro, type RiesgoHRP } from '../../core/riesgosHRP';
import type { Regla } from '../../core/tipos';

export interface CoberturaRiesgo {
  riesgo: RiesgoHRP;
  reglas: Regla[];
  escenarios: Escenario[];
  /** Lo cubre al menos una regla (o, para "sistemas", la guía paso a paso de toda alerta). */
  cubierto: boolean;
}

export const COBERTURA: Record<IdRiesgoHRP, CoberturaRiesgo> = Object.fromEntries(RIESGOS_HRP.map((riesgo) => {
  const reglas = REGLAS.filter((r) => r.hrp.includes(riesgo.id));
  const escenarios = ESCENARIOS.filter((e) => e.hrp.includes(riesgo.id));
  // "Soporte para operar sistemas" no es un dato: lo cubre que toda alerta traiga su guía (lo verifica cobertura.test.ts).
  return [riesgo.id, { riesgo, reglas, escenarios, cubierto: reglas.length > 0 || riesgo.id === 'sistemas' }];
})) as Record<IdRiesgoHRP, CoberturaRiesgo>;

export const TOTAL_RIESGOS = IDS_HRP.length;
export const RIESGOS_CUBIERTOS = IDS_HRP.filter((id) => COBERTURA[id].cubierto).length;

/** Nombre corto para el mosaico (el completo va en el detalle). */
export const NOMBRE_CORTO_HRP: Record<IdRiesgoHRP, string> = {
  inmune: 'Sistema inmune', sensoriomotor: 'Equilibrio y mareo', cardiovascular: 'Corazón y vasos', descompresion: 'Descompresión',
  microorganismos: 'Microorganismos', hipoxia: 'Hipoxia', nutricion: 'Nutrición', eva: 'Caminatas espaciales',
  aptitud: 'Fuerza y aptitud', sans: 'Visión (SANS)', oseo: 'Huesos', conductual: 'Salud mental',
  equipo: 'Trabajo en equipo', sueno: 'Sueño y horarios', sistemas: 'Autonomía operativa', cargasDinamicas: 'Cargas e impactos',
  radiacion: 'Radiación', trombosis: 'Coágulos venosos',
};

/**
 * Cada riesgo va en la columna de su peligro principal (el primero que declara el catálogo), así las
 * cinco columnas de la NASA quedan completas y cada mosaico aparece una sola vez.
 */
export const COLUMNAS: { peligro: Peligro; riesgos: IdRiesgoHRP[] }[] = PELIGROS.map((peligro) => ({
  peligro,
  riesgos: RIESGOS_HRP.filter((r) => r.peligros[0] === peligro).map((r) => r.id),
}));
