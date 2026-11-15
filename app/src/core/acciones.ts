/**
 * ACCIONES DEL ASISTENTE — lo que Higia puede hacer en la app a pedido del astronauta.
 * Las propone la IA (o el intérprete local, sin conexión) y las ejecuta la app.
 * Solo tipos y validación: no depende de React ni de la IA.
 */
import type { Actividad, DestinoComunicacion, Nivel, RegionCuerpo, SistemaCorporal, Ubicacion } from './tipos';
import { REGIONES, SISTEMAS } from './tipos';

export const SECCIONES_APP = ['asistente', 'resumen', 'mensajes', 'comunicaciones', 'perfil', 'entorno', 'reportes'] as const;
export type SeccionApp = (typeof SECCIONES_APP)[number];

/** A quién puede escribir o pedir ayuda el asistente. "todos" = todos los disponibles ahora. */
export type DestinoPedido = Exclude<DestinoComunicacion, 'baliza'> | 'todos';
export const DESTINOS_PEDIDO: DestinoPedido[] = ['companero', 'medico', 'base', 'tierra', 'todos'];

export type Accion =
  /** Emergencia: alerta en la app y mensaje a otros pidiendo ayuda. */
  | { tipo: 'pedir_ayuda'; destino: DestinoPedido; motivo: string }
  /** Mensaje informativo a otra persona (no es emergencia). */
  | { tipo: 'enviar_mensaje'; destino: DestinoPedido; mensaje: string }
  /** Alerta o aviso nuevo a partir de lo que cuenta el astronauta (síntoma, malestar, riesgo). */
  | { tipo: 'emitir_alerta'; nivel: Exclude<Nivel, 'normal'>; sistema: SistemaCorporal; titulo: string; detalle: string; region?: RegionCuerpo }
  /** Preguntas rápidas de orientación (persona, lugar, tiempo, atención): mide la desorientación. */
  | { tipo: 'chequeo_orientacion' }
  /** "Estoy bien": responde a las alertas que esperan confirmación. */
  | { tipo: 'confirmar_bien' }
  | { tipo: 'ir_a'; seccion: SeccionApp }
  | { tipo: 'mostrar_sistema'; sistema: SistemaCorporal }
  | { tipo: 'cambiar_contexto'; ubicacion?: Ubicacion; actividad?: Actividad }
  | { tipo: 'voz'; estado: 'silenciar' | 'activar' | 'detener' }
  /** Agrega un dato a la historia clínica (alergia, medicación, antecedente). */
  | { tipo: 'actualizar_historia'; campo: 'alergias' | 'medicacion' | 'antecedentes' | 'notas'; valor: string }
  /** Controles de la demo (simulador). */
  | { tipo: 'ejecutar_escenario'; escenario: string }
  | { tipo: 'control_simulador'; orden: OrdenSimulador }
  | { tipo: 'cambiar_astronauta'; astronauta: string };

export const ORDENES_SIMULADOR = ['pausar', 'continuar', 'siguiente', 'reiniciar', 'detener'] as const;
export type OrdenSimulador = (typeof ORDENES_SIMULADOR)[number];

const esTexto = (v: unknown, max = 500): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const en = <T extends string>(lista: readonly T[], v: unknown): v is T => typeof v === 'string' && (lista as readonly string[]).includes(v);

/**
 * Valida una acción que llega de la IA (o de cualquier fuente externa).
 * Devuelve null si no es válida: la app nunca ejecuta algo que no entiende.
 */
export function validarAccion(a: unknown): Accion | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  switch (o.tipo) {
    case 'pedir_ayuda':
      return en(DESTINOS_PEDIDO, o.destino) ? { tipo: 'pedir_ayuda', destino: o.destino, motivo: esTexto(o.motivo) ? o.motivo : 'Pedido de ayuda del astronauta.' } : null;
    case 'enviar_mensaje':
      return en(DESTINOS_PEDIDO, o.destino) && esTexto(o.mensaje) ? { tipo: 'enviar_mensaje', destino: o.destino, mensaje: o.mensaje } : null;
    case 'emitir_alerta':
      return en(['info', 'aviso', 'alerta'] as const, o.nivel) && en(SISTEMAS, o.sistema) && esTexto(o.titulo, 120) && esTexto(o.detalle)
        ? { tipo: 'emitir_alerta', nivel: o.nivel, sistema: o.sistema, titulo: o.titulo, detalle: o.detalle, region: en(REGIONES, o.region) ? o.region : undefined } : null;
    case 'chequeo_orientacion':
      return { tipo: 'chequeo_orientacion' };
    case 'confirmar_bien':
      return { tipo: 'confirmar_bien' };
    case 'ir_a':
      return en(SECCIONES_APP, o.seccion) ? { tipo: 'ir_a', seccion: o.seccion } : null;
    case 'mostrar_sistema':
      return en(SISTEMAS, o.sistema) ? { tipo: 'mostrar_sistema', sistema: o.sistema } : null;
    case 'cambiar_contexto': {
      const ubicacion = en(['habitat', 'eva', 'rover'] as const, o.ubicacion) ? o.ubicacion : undefined;
      const actividad = en(['reposo', 'trabajo', 'ejercicio'] as const, o.actividad) ? o.actividad : undefined;
      return ubicacion || actividad ? { tipo: 'cambiar_contexto', ubicacion, actividad } : null;
    }
    case 'voz':
      return en(['silenciar', 'activar', 'detener'] as const, o.estado) ? { tipo: 'voz', estado: o.estado } : null;
    case 'actualizar_historia':
      return en(['alergias', 'medicacion', 'antecedentes', 'notas'] as const, o.campo) && esTexto(o.valor, 200)
        ? { tipo: 'actualizar_historia', campo: o.campo, valor: o.valor } : null;
    case 'ejecutar_escenario':
      return esTexto(o.escenario, 60) ? { tipo: 'ejecutar_escenario', escenario: o.escenario } : null;
    case 'control_simulador':
      return en(ORDENES_SIMULADOR, o.orden) ? { tipo: 'control_simulador', orden: o.orden } : null;
    case 'cambiar_astronauta':
      return esTexto(o.astronauta, 60) ? { tipo: 'cambiar_astronauta', astronauta: o.astronauta } : null;
    default:
      return null;
  }
}

export function validarAcciones(lista: unknown): Accion[] {
  return Array.isArray(lista) ? lista.map(validarAccion).filter((a): a is Accion => a !== null).slice(0, 6) : [];
}
