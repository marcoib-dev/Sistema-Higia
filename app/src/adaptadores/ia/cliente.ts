/**
 * Cliente de la IA de Higia (habla con app/server por HTTP).
 * La app la usa siempre que el servidor tenga clave configurada. Si falla, se vuelve al intérprete local.
 */
import { fechaLegible, horaHabitat, parteDelDia } from '../../core/momento';
import type { NucleoSalud } from '../../core/nucleo';
import { durmiendo } from '../../core/proactivo';
import { RIESGO_HRP } from '../../core/riesgosHRP';
import { INFO_SENSOR, NOMBRE_DESTINO, NOMBRE_TAREA, RETARDO_TIERRA, TAREAS_CRITICAS, type Hallazgo, type Mensaje, type TipoSensor } from '../../core/tipos';
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
      riesgosNASA: riesgosNASA(h),
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

const riesgosNASA = (h: Hallazgo) => (h.hrp ?? []).map((id) => `${RIESGO_HRP[id].nombre} (§${RIESGO_HRP[id].seccion})`);

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
  const c = n.contexto;
  const { inicio, fin } = n.perfil.horarioSueno;
  const aptitud = n.aptitudTareas();
  const UBIC = { habitat: 'en el hábitat', eva: 'afuera, en una EVA', rover: 'en el rover' };
  const ACT = { reposo: 'en reposo', trabajo: 'trabajando', ejercicio: 'haciendo ejercicio' };
  const entorno = [
    `Está ${UBIC[c.ubicacion]}, ${ACT[c.actividad]}, en la misión a ${NOMBRE_DESTINO[c.destino]} (día ${c.diaMision})`,
    `clima espacial ${c.climaEspacial === 'tormentaSolar' ? 'con TORMENTA SOLAR activa' : 'calmo'}`,
    c.companeroCercano ? 'hay un compañero al alcance de la radio' : 'no hay compañero al alcance',
    c.medicoABordo ? 'hay médico a bordo' : 'no hay médico a bordo',
    c.conexionHabitat ? 'conectado a la red del hábitat' : 'sin conexión con el hábitat (modo autónomo)',
    c.conexionTierra ? `con enlace a Tierra (retardo ${RETARDO_TIERRA[c.destino]})` : 'sin enlace con Tierra',
    c.transicionGravedad ? 'en transición de gravedad (últimas 72 h)' : '',
  ].filter(Boolean).join('; ');
  return {
    perfil: { formacionMedica, experiencia, toleranciaEstres, propensoPanico, historiaClinica },
    contexto: { ...c },
    momento: {
      horaHabitat: horaHabitat(c, ahora), fecha: fechaLegible(ahora), parteDelDia: parteDelDia(c.hora), diaMision: c.diaMision,
      horarioSueno: `${inicio}:00 a ${fin}:00`, enHorarioDeSueno: durmiendo(n.perfil, c),
    },
    entorno,
    aptitudTareas: TAREAS_CRITICAS.map((t) => ({ tarea: NOMBRE_TAREA[t], apto: aptitud[t].apto, motivos: aptitud[t].motivos.map((h) => h.titulo) })),
    companeros: n.companeros,
    hallazgos: n.hallazgosActuales().map((h) => ({ titulo: h.titulo, nivel: h.nivel, detalle: h.detalleTecnico, sensible: h.sensible, riesgosNASA: riesgosNASA(h) })),
    ultimasLecturas,
    lecturasRecientes,
    lineaBase,
    app,
  };
}
