import type { Historial } from '../historial';
import { promedio } from '../historial';
import type { Contexto, DatoClinico, Hallazgo, Lectura, Nivel, Perfil, Regla, SistemaCorporal, TipoSensor } from '../tipos';

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

export type DatosHallazgo = Omit<Hallazgo, 'riesgoId' | 'sistema' | 'fuente' | 'timestamp'>;

/** El dato de una lectura, con la línea base de la persona si la tiene. */
export function dato(l: Lectura, p: Perfil): DatoClinico {
  return { sensor: l.sensor, valor: l.valor, timestamp: l.timestamp, fuente: l.fuente, lineaBase: p.lineaBase[l.sensor] };
}

/**
 * Crea una regla completando automáticamente id, sistema, fuente, riesgos HRP y timestamp del hallazgo.
 * Si la regla no dice qué datos usó, se registran las últimas lecturas de sus sensores:
 * todo análisis queda trazable a los datos concretos en que se apoya.
 */
export function definirRegla(
  meta: Omit<Regla, 'evaluar'>,
  evaluar: (h: Historial, p: Perfil, ahora: number, c: Contexto) => DatosHallazgo | null,
): Regla {
  return {
    ...meta,
    evaluar(h, p, ahora, c) {
      const d = evaluar(h, p, ahora, c);
      if (!d) return null;
      const datos = d.datos ?? meta.sensores.map((s) => h.ultima(s)).filter((l): l is Lectura => !!l).map((l) => dato(l, p));
      return { ...d, hrp: d.hrp ?? meta.hrp, datos, riesgoId: meta.id, sistema: meta.sistema, fuente: meta.fuente, timestamp: ahora };
    },
  };
}

export function normal(titulo: string, detalleTecnico: string, sensible = false): DatosHallazgo {
  return {
    nivel: 'normal', titulo, detalleTecnico, resumenSimple: 'Todo en orden.',
    accion: '', ruta: 'autogestion', sensible,
  };
}

export const r1 = (x: number) => Math.round(x * 10) / 10;
export const signo = (x: number) => (x >= 0 ? `+${r1(x)}` : `${r1(x)}`);
export const pct = (x: number) => `${Math.round(x * 100)} %`;

// ── Ventanas de tiempo ─────────────────────────────────────────────────

/** Lecturas de las últimas `horas` horas. */
export const recientes = (h: Historial, s: TipoSensor, ahora: number, horas: number): Lectura[] =>
  h.desde(s, ahora - horas * HORA);

/** Última lectura dentro de las últimas `horas` horas. */
export const ultimaReciente = (h: Historial, s: TipoSensor, ahora: number, horas: number): Lectura | undefined =>
  recientes(h, s, ahora, horas).at(-1);

/** Datos clínicos de varias lecturas (ignora las que faltan). */
export const datosDe = (p: Perfil, ...ls: (Lectura | undefined)[]): DatoClinico[] =>
  ls.filter((l): l is Lectura => !!l).map((l) => dato(l, p));

/** Inicio del día calendario (hora local) que contiene `t`. */
const inicioDia = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * Valores por día calendario de los últimos `dias` días (incluido hoy), del más viejo al más nuevo.
 * `agregar` resume las lecturas de un mismo día (por defecto, el promedio). Los días sin datos no aparecen.
 */
export function porDia(
  h: Historial, s: TipoSensor, ahora: number, dias: number,
  agregar: (xs: number[]) => number = promedio,
): { dia: number; valor: number; lecturas: Lectura[] }[] {
  const hoy = inicioDia(ahora);
  const salida: { dia: number; valor: number; lecturas: Lectura[] }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const desde = hoy - i * DIA;
    const ls = h.entre(s, desde, desde + DIA - 1).filter((l) => l.timestamp <= ahora);
    if (ls.length) salida.push({ dia: desde, valor: agregar(ls.map((l) => l.valor)), lecturas: ls });
  }
  return salida;
}

/** Promedio de los promedios diarios de los últimos `dias` días (NaN si no hay datos). */
export function promedioDiario(h: Historial, s: TipoSensor, ahora: number, dias: number): number {
  return promedio(porDia(h, s, ahora, dias).map((d) => d.valor));
}

/** Cuántos de los últimos `dias` días (con datos) cumplen la condición sobre su valor diario. */
export function diasCumpliendo(
  h: Historial, s: TipoSensor, ahora: number, dias: number, predicado: (v: number) => boolean,
  agregar?: (xs: number[]) => number,
): { cumplen: number; conDatos: number } {
  const ds = porDia(h, s, ahora, dias, agregar);
  return { cumplen: ds.filter((d) => predicado(d.valor)).length, conDatos: ds.length };
}

/** Tendencia por día (pendiente de una regresión lineal simple). Null con menos de 3 puntos. */
export function pendiente(h: Historial, s: TipoSensor, ahora: number, dias: number): number | null {
  const ls = h.entre(s, ahora - dias * DIA, ahora);
  if (ls.length < 3) return null;
  const xs = ls.map((l) => (l.timestamp - ls[0].timestamp) / DIA);
  const ys = ls.map((l) => l.valor);
  const mx = promedio(xs);
  const my = promedio(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? null : num / den;
}

/** Caída relativa de un valor respecto de su base (0,2 = 20 % por debajo). Negativa si subió. */
export const caidaRelativa = (valor: number, base: number): number => (base === 0 ? 0 : (base - valor) / base);

/** Sube un nivel (info → aviso → alerta). `normal` queda igual. */
export const subirNivel = (n: Nivel): Nivel => (n === 'info' ? 'aviso' : n === 'aviso' ? 'alerta' : n);

// ── Factores compartidos ───────────────────────────────────────────────

export interface Factor { activo: boolean; texto: string; datos: DatoClinico[] }

/**
 * Factores de riesgo que varias reglas usan como agravante: sueño corto, estrés alto y dosis de radiación alta.
 * Cada uno con los datos en que se basa, para la trazabilidad.
 */
export function factor(h: Historial, p: Perfil, ahora: number): { suenoBajo: Factor; estresAlto: Factor; dosisAlta: Factor } {
  const noches = h.ultimas('horasSueno', 3).filter((l) => l.timestamp >= ahora - 4 * DIA);
  const sueno = noches.length ? r1(promedio(noches.map((n) => n.valor))) : undefined;
  const estres = ultimaReciente(h, 'estres', ahora, 24);
  const dosis = h.ultima('dosisRadiacion');
  return {
    suenoBajo: {
      activo: sueno !== undefined && sueno < 6, texto: `sueño promedio ${sueno} h`, datos: noches.map((n) => dato(n, p)),
    },
    estresAlto: {
      activo: !!estres && estres.valor >= 70, texto: `estrés ${estres?.valor}/100`, datos: datosDe(p, estres),
    },
    dosisAlta: {
      // Mitad del límite de carrera (600 mSv): la radiación es un estresor del sistema inmune.
      activo: !!dosis && dosis.valor >= 300, texto: `dosis acumulada ${dosis ? r1(dosis.valor) : 0} mSv`, datos: datosDe(p, dosis),
    },
  };
}

/** Antecedente de la historia clínica en un sistema del cuerpo (y que cumpla el patrón, si se da). */
export function tieneAntecedente(p: Perfil, sistema: SistemaCorporal, patron?: RegExp): boolean {
  return p.historiaClinica.antecedentes.some((a) => a.sistema === sistema && (!patron || patron.test(`${a.nombre} ${a.detalle ?? ''}`)));
}
