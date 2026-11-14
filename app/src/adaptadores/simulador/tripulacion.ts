/**
 * SIMULADOR DE LA TRIPULACIÓN — respuestas de quienes reciben las comunicaciones de Higia.
 * En la realidad llegarían por la radio de proximidad o la red del hábitat; aquí se simulan para la demo.
 */
import type { Comunicacion } from '../../core/tipos';

/** Respuesta simulada y cuándo llega (ms después del envío). Null si nadie responde (baliza, en cola). */
export function respuestaSimulada(c: Comunicacion, companero?: string): { texto: string; enMs: number } | null {
  if (c.estado !== 'enviado') return null;
  const nombre = companero?.split(' ')[0] ?? 'Tu compañero';
  const urgente = c.tipo === 'emergencia';
  // Tierra: el retardo real de Marte es de minutos; en la demo se escala para que se vea.
  const retardoTierra = c.retardo?.includes('min') ? 20_000 : 3_500;
  switch (c.destino) {
    case 'companero':
      return { texto: urgente ? `${nombre}: Recibido, voy para allá. Llego en 2 minutos.` : `${nombre}: Recibido, gracias.`, enMs: 4_000 };
    case 'medico':
      return { texto: urgente ? 'Médico de a bordo: Voy en camino con el botiquín.' : 'Médico de a bordo: Recibido.', enMs: 5_000 };
    case 'base':
      return { texto: urgente ? 'Base: Recibido. El equipo médico está en contacto y sale un equipo de apoyo.' : 'Base: Recibido.', enMs: 6_000 };
    case 'tierra':
      return { texto: urgente ? 'Control en Tierra: Recibido. El cirujano de vuelo revisa tus datos.' : 'Control en Tierra: Mensaje recibido.', enMs: retardoTierra * 2 };
    case 'baliza':
      return null;
  }
}
