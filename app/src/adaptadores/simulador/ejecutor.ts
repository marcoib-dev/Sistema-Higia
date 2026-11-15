/**
 * Cómo se arma un núcleo para un escenario y cómo se aplica un paso sin interfaz.
 * Lo usan los tests de escenarios; la app hace lo mismo pero pasando la frase por el asistente.
 */
import { interpretar } from '../../core/conversacion';
import { NucleoSalud } from '../../core/nucleo';
import { REGLAS } from '../../core/reglas';
import type { Contexto, Mensaje, Perfil } from '../../core/tipos';
import { CONTEXTO_BASE, type Escenario, type PasoEscenario } from './escenarios';
import { PERFILES } from './perfiles';

/** Núcleo nuevo, con los demás tripulantes como compañeros. */
export function nuevoNucleo(perfil: Perfil, contexto: Contexto): NucleoSalud {
  const n = new NucleoSalud(REGLAS, perfil, contexto);
  n.companeros = PERFILES.filter((p) => p.id !== perfil.id).map((p) => p.nombre);
  return n;
}

/** Perfil con el que corre un escenario: el sugerido o, si no sugiere, el actual. */
export const perfilDe = (e: Escenario, actual: Perfil): Perfil => PERFILES.find((p) => p.id === e.perfil) ?? actual;

/** Núcleo limpio para el escenario, con su contexto inicial y la precarga ya cargada (sin mensajes). */
export function prepararEscenario(e: Escenario, perfil: Perfil, t: number, contextoBase: Contexto = CONTEXTO_BASE): NucleoSalud {
  const n = nuevoNucleo(perfil, { ...contextoBase, ...e.contextoInicial });
  if (e.precarga) n.precargar(e.precarga(t, perfil), t);
  return n;
}

/** Aplica un paso: contexto → lecturas → frase (por el intérprete local). Devuelve los mensajes. */
export function aplicarPasoLocal(n: NucleoSalud, paso: PasoEscenario, t: number): Mensaje[] {
  const salida: Mensaje[] = [];
  if (paso.contexto) salida.push(...n.actualizarContexto(paso.contexto, t));
  if (paso.lecturas) salida.push(...n.registrar(paso.lecturas(t, n.historial, n.perfil), t));
  if (paso.frase) {
    const r = interpretar(paso.frase, n, t);
    for (const a of r.acciones) {
      if (a.tipo === 'emitir_alerta') salida.push(...n.alertaDesdeConversacion(a, t));
      if (a.tipo === 'pedir_ayuda') salida.push(n.pedirAyuda(a.destino, a.motivo, t));
      if (a.tipo === 'cambiar_contexto') salida.push(...n.actualizarContexto({ ubicacion: a.ubicacion, actividad: a.actividad }, t));
    }
    if (r.lecturas.length) salida.push(...n.registrar(r.lecturas.map((l) => ({ ...l, timestamp: t })), t));
  }
  return salida;
}
