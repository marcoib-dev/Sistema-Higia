/**
 * Cliente de la IA de Higia (habla con app/server por HTTP).
 * La app decide cuándo usarla: solo con conexión al hábitat. Si falla, se vuelve al intérprete local.
 */
import type { NucleoSalud } from '../../core/nucleo';
import type {
  AnalisisEntorno, EstadoIA, EstadoParaIA, PeticionConversacion, PeticionEntorno, RespuestaConversacion,
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

/** Arma la foto del estado para la IA. Sin el nombre del astronauta (privacidad). */
export function estadoParaIA(n: NucleoSalud): EstadoParaIA {
  const { formacionMedica, experiencia, toleranciaEstres, propensoPanico } = n.perfil;
  const ultimasLecturas: Record<string, number> = {};
  for (const s of ['frecuenciaCardiaca', 'presionSistolica', 'presionDiastolica', 'spo2', 'horasSueno', 'animo', 'estres', 'minutosEjercicio', 'dosisRadiacion'] as const) {
    const l = n.historial.ultima(s);
    if (l) ultimasLecturas[s] = l.valor;
  }
  return {
    perfil: { formacionMedica, experiencia, toleranciaEstres, propensoPanico },
    contexto: { ...n.contexto },
    hallazgos: n.hallazgosActuales().map((h) => ({ titulo: h.titulo, nivel: h.nivel, detalle: h.detalleTecnico, sensible: h.sensible })),
    ultimasLecturas,
  };
}
