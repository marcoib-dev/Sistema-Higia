/**
 * ⚠️ INTERFAZ DE EJEMPLO: NO es una API real de la NASA.
 *
 * Muestra cómo el núcleo autónomo exporta hallazgos a un sistema médico externo cuando hay conexión.
 * El formato se inspira en HL7 FHIR "Observation", un estándar abierto de interoperabilidad clínica.
 * Para conectar un sistema real, basta con implementar `AdaptadorExterno`.
 */
import type { Hallazgo, Perfil } from '../../core/tipos';

export interface AdaptadorExterno {
  readonly nombre: string;
  enviar(hallazgos: Hallazgo[], perfil: Perfil): Promise<number>;
}

export function aObservacion(h: Hallazgo, p: Perfil) {
  return {
    resourceType: 'Observation',
    status: 'preliminary',
    code: { text: h.titulo },
    // Privacidad: se envía el identificador, no el nombre. (Punto abierto: control del astronauta sobre sus datos.)
    subject: { reference: `Astronaut/${p.id}` },
    effectiveDateTime: new Date(h.timestamp).toISOString(),
    interpretation: [{ text: h.nivel }],
    valueString: h.detalleTecnico,
    note: [{ text: `Riesgo ${h.riesgoId} · ${h.fuente}` }],
  };
}

export type Observacion = ReturnType<typeof aObservacion>;

export class AdaptadorEjemplo implements AdaptadorExterno {
  readonly nombre = 'Sistema médico del hábitat (EJEMPLO)';
  readonly enviados: Observacion[] = [];

  async enviar(hallazgos: Hallazgo[], perfil: Perfil): Promise<number> {
    this.enviados.push(...hallazgos.map((h) => aObservacion(h, perfil)));
    return hallazgos.length;
  }
}
