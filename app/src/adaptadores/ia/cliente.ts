/**
 * Cliente de la IA de Higia (habla con app/server por HTTP).
 * La app la usa siempre que el servidor tenga clave configurada. Si falla, se vuelve al intérprete local.
 */
import type { NucleoSalud } from '../../core/nucleo';
import { INFO_SENSOR, type Mensaje, type TipoSensor } from '../../core/tipos';
import type {
  AnalisisEntorno, EstadoIA, EstadoParaIA, EvaluacionIA, PeticionConversacion, PeticionEntorno, PeticionEvaluacion,
  RespuestaConversacion,
} from './contrato';

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`/api/ia/${ruta}`, cuerpo === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({ error: `Error ${r.status}` }));
  if (!r.ok) throw new Error(datos.error ?? `Error ${r.status}`);
  return datos as T;
}

export async function consultarEstadoIA(): Promise<EstadoIA> {
  try {
    return await pedir<EstadoIA>('estado');
  } catch {
    return { configurada: false, modelo: '' }; // p. ej. build estático sin servidor
  }
}

export const conversarIA = (p: PeticionConversacion) => pedir<RespuestaConversacion>('conversar', p);
export const analizarEntornoIA = (p: PeticionEntorno) => pedir<AnalisisEntorno>('entorno', p);
export const evaluarIA = (p: PeticionEvaluacion) => pedir<EvaluacionIA>('evaluar', p);

/** Arma la petición de evaluación de un mensaje del motor. */
export function peticionEvaluacion(m: Mensaje, n: NucleoSalud, ahora = Date.now()): PeticionEvaluacion {
  const h = m.hallazgo;
  return {
    hallazgo: {
      titulo: h.titulo, nivel: h.nivel, resumen: h.resumenSimple, detalle: h.detalleTecnico,
      accion: h.accionPorUbicacion?.[n.contexto.ubicacion] ?? h.accion, sensible: h.sensible, fuente: h.fuente,
      datos: (h.datos ?? []).map((d) => ({
        dato: INFO_SENSOR[d.sensor].nombre, valor: d.valor, unidad: INFO_SENSOR[d.sensor].unidad,
        haceMin: minutosDesde(d.timestamp, ahora), lineaBase: d.lineaBase,
      })),
      series: Object.fromEntries([...new Set((h.datos ?? []).map((d) => d.sensor))].map((s) => [
        INFO_SENSOR[s].nombre, n.historial.ultimas(s, 8).map((l) => ({ valor: l.valor, haceMin: minutosDesde(l.timestamp, ahora) })),
      ])),
    },
    mensaje: m.texto,
    estado: estadoParaIA(n),
  };
}

const minutosDesde = (ts: number, ahora: number) => Math.max(0, Math.round((ahora - ts) / 60_000));

/**
 * Arma la foto del estado para la IA. Sin el nombre del astronauta (privacidad).
 * `app` agrega lo que el asistente necesita para controlar la app (sección, alertas, comunicaciones…).
 */
export function estadoParaIA(n: NucleoSalud, app?: EstadoParaIA['app']): EstadoParaIA {
  const { formacionMedica, experiencia, toleranciaEstres, propensoPanico, historiaClinica } = n.perfil;
  const ahora = Date.now();
  const ultimasLecturas: Record<string, number> = {};
  const lecturasRecientes: EstadoParaIA['lecturasRecientes'] = {};
  for (const s of Object.keys(INFO_SENSOR) as TipoSensor[]) {
    const ls = n.historial.ultimas(s, 5);
    if (!ls.length) continue;
    ultimasLecturas[s] = ls[ls.length - 1].valor;
    lecturasRecientes[INFO_SENSOR[s].nombre] = ls.map((l) => ({ valor: l.valor, unidad: INFO_SENSOR[s].unidad, haceMin: minutosDesde(l.timestamp, ahora) }));
  }
  const lineaBase = Object.fromEntries(Object.entries(n.perfil.lineaBase).map(([s, v]) => [INFO_SENSOR[s as TipoSensor].nombre, v as number]));
  return {
    perfil: { formacionMedica, experiencia, toleranciaEstres, propensoPanico, historiaClinica },
    contexto: { ...n.contexto },
    hallazgos: n.hallazgosActuales().map((h) => ({ titulo: h.titulo, nivel: h.nivel, detalle: h.detalleTecnico, sensible: h.sensible })),
    ultimasLecturas,
    lecturasRecientes,
    lineaBase,
    app,
  };
}
