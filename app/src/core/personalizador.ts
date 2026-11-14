/**
 * PERSONALIZACIÓN — qué se dice y con cuánto detalle, según el perfil.
 * Mismo hallazgo → distinto texto para una médica veterana y un ingeniero novato.
 */
import type { Contexto, Hallazgo, Perfil } from './tipos';

const primeraOracion = (t: string) => (t.match(/^[^.!?]*[.!?]/)?.[0] ?? t).trim();

export function redactar(h: Hallazgo, p: Perfil, c: Contexto, opciones: { breve?: boolean } = {}): string {
  if (h.nivel === 'normal') {
    return p.formacionMedica === 'medico' ? `${h.titulo}: ${h.detalleTecnico}. Normal.` : `${h.titulo}: todo en orden.`;
  }

  // A quien tiene baja tolerancia al estrés no se le nombra lo que puede empeorar la situación.
  const calmar = h.sensible && !!h.textoCalmado && (p.propensoPanico || p.toleranciaEstres === 'baja');

  const estado = calmar
    ? h.textoCalmado!
    : p.formacionMedica === 'medico'
      ? `${h.titulo}. ${h.detalleTecnico}.`
      : p.formacionMedica === 'basica'
        ? `${h.resumenSimple} (${h.detalleTecnico}).`
        : h.resumenSimple;

  let accion = h.accionPorUbicacion?.[c.ubicacion] ?? h.accion;
  // Al veterano no se le repite el procedimiento que ya conoce (salvo en alertas).
  if (p.experiencia === 'veterano' && h.nivel !== 'alerta') accion = primeraOracion(accion);

  if (opciones.breve) return [primeraOracion(estado), primeraOracion(accion)].filter(Boolean).join(' ');
  return `${estado} ${accion}`.trim();
}

/**
 * Frecuencia de recordatorios mientras un aviso sigue activo.
 * null = solo se habla cuando algo cambia (modo proactivo puro).
 */
export function intervaloRecordatorioMs(p: Perfil): number | null {
  switch (p.experiencia) {
    case 'novato': return 15 * 60_000;
    case 'intermedio': return 45 * 60_000;
    case 'veterano': return null;
  }
}
