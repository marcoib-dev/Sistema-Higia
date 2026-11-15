/**
 * REGISTRO DE LA SIMULACIÓN — qué inyectó el simulador y qué hizo Higia, con el porqué.
 * Lista acotada: lo alimentan la app (al procesar mensajes y cambiar contexto) y el reproductor.
 */
import type { Nivel } from '../../core/tipos';

export type TipoEvento = 'paso' | 'lecturas' | 'contexto' | 'hallazgo' | 'mensaje' | 'escalada' | 'respuesta' | 'frase';

export const NOMBRE_TIPO_EVENTO: Record<TipoEvento, string> = {
  paso: 'Paso', lecturas: 'Datos', contexto: 'Contexto', hallazgo: 'Hallazgo', mensaje: 'Mensaje',
  escalada: 'Escalada', respuesta: 'Respuesta', frase: 'Frase',
};

export interface EventoRegistro {
  id: number;
  t: number;
  tipo: TipoEvento;
  texto: string;
  nivel?: Nivel;
  /** Para un mensaje: por qué ese canal. */
  detalle?: string;
}

export const MAX_EVENTOS = 200;

export class RegistroSimulacion {
  private eventos: EventoRegistro[] = [];
  private seq = 0;

  agregar(e: Omit<EventoRegistro, 'id' | 't'> & { t?: number }): void {
    this.eventos.push({ ...e, t: e.t ?? Date.now(), id: ++this.seq });
    if (this.eventos.length > MAX_EVENTOS) this.eventos.splice(0, this.eventos.length - MAX_EVENTOS);
  }

  /** Del más nuevo al más viejo. */
  lista(): EventoRegistro[] {
    return [...this.eventos].reverse();
  }

  limpiar(): void {
    this.eventos = [];
  }

  get cantidad(): number {
    return this.eventos.length;
  }

  /** Para "copiar como texto": una línea por evento, en orden cronológico. */
  comoTexto(): string {
    return this.eventos.map((e) => {
      const hora = new Date(e.t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `${hora} [${NOMBRE_TIPO_EVENTO[e.tipo]}${e.nivel ? ` · ${e.nivel}` : ''}] ${e.texto}${e.detalle ? ` — ${e.detalle}` : ''}`;
    }).join('\n');
  }
}
