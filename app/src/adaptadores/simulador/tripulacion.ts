/**
 * SIMULADOR DE LA TRIPULACIÓN — respuestas de quienes reciben las comunicaciones de Higia.
 * En la realidad llegarían por la radio de proximidad o la red del hábitat; aquí se simulan para la demo.
 * La conducta se puede cambiar desde el simulador: "nadie responde → baliza", "Tierra responde con retardo".
 */
import type { Comunicacion } from '../../core/tipos';

export interface ConductaTripulacion {
  /** Compañero y base responden. */
  responde: boolean;
  /** Demora extra antes de cada respuesta. */
  demoraMs: number;
  medicoResponde: boolean;
  tierraResponde: boolean;
}

export const CONDUCTA_NORMAL: ConductaTripulacion = { responde: true, demoraMs: 0, medicoResponde: true, tierraResponde: true };

/** Respuesta simulada y cuándo llega (ms después del envío). Null si nadie responde (baliza, en cola, o así lo dice la conducta). */
export function respuestaSimulada(
  c: Comunicacion, companero?: string, conducta: ConductaTripulacion = CONDUCTA_NORMAL,
): { texto: string; enMs: number } | null {
  if (c.estado !== 'enviado') return null;
  const nombre = companero?.split(' ')[0] ?? 'Tu compañero';
  const urgente = c.tipo === 'emergencia';
  // Tierra: el retardo real de Marte es de minutos; en la demo se escala para que se vea.
  const retardoTierra = c.retardo?.includes('min') ? 20_000 : 3_500;
  const extra = conducta.demoraMs;
  switch (c.destino) {
    case 'companero':
      if (!conducta.responde) return null;
      return { texto: urgente ? `${nombre}: Recibido, voy para allá. Llego en 2 minutos.` : `${nombre}: Recibido, gracias.`, enMs: 4_000 + extra };
    case 'medico':
      if (!conducta.medicoResponde) return null;
      return { texto: urgente ? 'Médico de a bordo: Voy en camino con el botiquín.' : 'Médico de a bordo: Recibido.', enMs: 5_000 + extra };
    case 'base':
      if (!conducta.responde) return null;
      return { texto: urgente ? 'Base: Recibido. El equipo médico está en contacto y sale un equipo de apoyo.' : 'Base: Recibido.', enMs: 6_000 + extra };
    case 'tierra':
      if (!conducta.tierraResponde) return null;
      return { texto: urgente ? 'Control en Tierra: Recibido. El cirujano de vuelo revisa tus datos.' : 'Control en Tierra: Mensaje recibido.', enMs: retardoTierra * 2 + extra };
    case 'baliza':
      return null;
  }
}
