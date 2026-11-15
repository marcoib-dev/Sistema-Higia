import { useState } from 'react';
import { PERFILES } from '../../adaptadores/simulador/perfiles';
import type { Historial } from '../../core/historial';
import { redactar } from '../../core/personalizador';
import { RIESGO_HRP } from '../../core/riesgosHRP';
import { antecedentesDe, INFO_SENSOR, type Contexto, type DatoClinico, type HistoriaClinica, type Mensaje, type TipoSensor } from '../../core/tipos';
import { CANAL, EncabezadoSeccion, Etiqueta, InsigniaNivel, sinTitulo, Vacio } from '../componentes/basicos';
import { DATOS_CON_TENDENCIA, MiniTendencia } from '../componentes/MiniTendencia';
import { Icono } from '../iconos';

type Filtro = 'todos' | 'alertas' | 'retenidos' | 'escalados';

/** Evaluación de la IA asociada a un mensaje del motor. */
export type EvaluacionMensaje =
  | { estado: 'cargando' }
  | { estado: 'lista'; evaluacion: string; recomendacion: string; datosUsados: string[]; limitaciones: string }
  | { estado: 'error'; error: string };

const FILTROS: { id: Filtro; nombre: string; aplica: (m: Mensaje) => boolean }[] = [
  { id: 'todos', nombre: 'Todos', aplica: () => true },
  { id: 'alertas', nombre: 'Alertas', aplica: (m) => m.hallazgo.nivel === 'alerta' && !m.escalamiento },
  { id: 'retenidos', nombre: 'Retenidos', aplica: (m) => m.diferido },
  { id: 'escalados', nombre: 'Escalados', aplica: (m) => !!m.escalamiento },
];

interface Props {
  mensajes: Mensaje[];
  evaluaciones: Record<string, EvaluacionMensaje>;
  pendientes: Map<string, number>;
  ahora: number;
  contexto: Contexto;
  historia: HistoriaClinica;
  historial: Historial;
  onConfirmar: (id: string) => void;
  onAbrirDemo: () => void;
}

export function VistaMensajes({ mensajes, evaluaciones, pendientes, ahora, contexto, historia, historial, onConfirmar, onAbrirDemo }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const visibles = mensajes.filter(FILTROS.find((f) => f.id === filtro)!.aplica);

  return (
    <>
      <EncabezadoSeccion titulo="Mensajes" descripcion="Lo que Higia le comunicó al astronauta, por qué canal y por qué." />
      <div className="filtros" role="tablist" aria-label="Filtrar mensajes">
        {FILTROS.map((f) => {
          const n = mensajes.filter(f.aplica).length;
          return (
            <button key={f.id} role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}>
              {f.nombre} <span className="filtro-n">{n}</span>
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <Vacio icono="mensajes" titulo={mensajes.length ? 'Nada en este filtro' : 'Sin mensajes todavía'}>
          {!mensajes.length && <>Higia solo habla cuando algo cambia. <button className="boton-enlace" onClick={onAbrirDemo}>Ejecuta un escenario en el simulador</button> para ver cómo responde.</>}
        </Vacio>
      ) : (
        <ol className="lista-mensajes">
          {visibles.map((m) => (
            <TarjetaMensaje key={m.id} mensaje={m} historia={historia} historial={historial} evaluacion={evaluaciones[m.id]} vence={pendientes.get(m.id)} ahora={ahora} contexto={contexto} onConfirmar={onConfirmar} />
          ))}
        </ol>
      )}
    </>
  );
}

function TarjetaMensaje({ mensaje: m, historia, historial, evaluacion, vence, ahora, contexto, onConfirmar }: {
  mensaje: Mensaje; historia: HistoriaClinica; historial: Historial; evaluacion?: EvaluacionMensaje; vence?: number; ahora: number; contexto: Contexto; onConfirmar: (id: string) => void;
}) {
  const canal = CANAL[m.canal];
  const segundos = vence ? Math.max(0, Math.ceil((vence - ahora) / 1000)) : 0;

  return (
    <li className={`mensaje nivel-borde-${m.escalamiento ? 'alerta' : m.hallazgo.nivel} ${m.diferido ? 'mensaje-retenido' : ''}`}>
      <div className="mensaje-cab">
        {m.escalamiento ? <Etiqueta icono="escalado" tono="alerta">Escalado</Etiqueta> : <InsigniaNivel nivel={m.hallazgo.nivel} />}
        <h3>{m.hallazgo.titulo}</h3>
        <time dateTime={new Date(m.timestamp).toISOString()}>{new Date(m.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
      </div>

      <p className="mensaje-texto">{sinTitulo(m.texto, m.hallazgo.titulo)}</p>

      {antecedentesDe(historia, m.hallazgo.sistema).length > 0 && !m.escalamiento && (
        <p className="mensaje-antecedente">
          <Icono nombre="documento" tamano={16} /> Antecedente relevante: {antecedentesDe(historia, m.hallazgo.sistema).map((a) => a.nombre).join(', ')}
        </p>
      )}

      <div className="mensaje-etiquetas">
        <Etiqueta icono={canal.icono}>{canal.nombre}</Etiqueta>
        {m.diferido && <Etiqueta icono="retenido">Retenido</Etiqueta>}
        {m.hallazgo.sensible && <Etiqueta icono="candado">Privado</Etiqueta>}
        {m.esRecordatorio && <Etiqueta icono="recordatorio">Recordatorio</Etiqueta>}
        {m.hallazgo.hrp?.slice(0, 2).map((id) => <Etiqueta key={id} icono="escudo" tono="nasa">Riesgo NASA: {RIESGO_HRP[id].nombre}</Etiqueta>)}
      </div>

      {vence !== undefined && (
        <div className="confirmacion">
          <span>Esperando respuesta: se avisará a otros en <b>{segundos} s</b>.</span>
          <button className="boton boton-ok" onClick={() => onConfirmar(m.id)}><Icono nombre="check" /> Estoy bien</button>
        </div>
      )}

      {m.escalamiento && (
        <p className="mensaje-destino"><Icono nombre="escalado" tamano={16} /> Avisados: {m.escalamiento.destinos.join(', ')}</p>
      )}
      {m.reporte && <p className="mensaje-destino"><Icono nombre="reportes" tamano={16} /> {m.reporte}</p>}

      {evaluacion && (
        <div className={`evaluacion-ia ${evaluacion.estado}`} aria-live="polite">
          <p className="evaluacion-ia-titulo"><Icono nombre="ia" tamano={16} /> Evaluación de Higia · IA</p>
          {evaluacion.estado === 'cargando' && <p className="texto-suave">La IA está evaluando este hallazgo…</p>}
          {evaluacion.estado === 'lista' && (
            <>
              <p>{evaluacion.evaluacion}</p>
              {evaluacion.recomendacion && <p className="evaluacion-ia-accion"><b>Siguiente paso:</b> {evaluacion.recomendacion}</p>}
              {evaluacion.datosUsados.length > 0
                ? <p className="evaluacion-ia-datos"><b>Datos que usó:</b> {evaluacion.datosUsados.join(' · ')}</p>
                : <p className="evaluacion-ia-datos aviso">La IA no citó datos: tómala con cautela y guíate por el mensaje del motor.</p>}
              {evaluacion.limitaciones && <p className="evaluacion-ia-datos"><b>Limitaciones:</b> {evaluacion.limitaciones}</p>}
            </>
          )}
          {evaluacion.estado === 'error' && <p className="nota">IA no disponible ({evaluacion.error}). Vale el mensaje del motor local.</p>}
        </div>
      )}

      {m.pasos && (
        <div className="pasos">
          <p>Qué hacer, paso a paso (no hay médico a bordo)</p>
          <ol>{m.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      )}

      <Tendencias mensaje={m} historial={historial} />

      {!!m.hallazgo.datos?.length && <DatosUsados datos={m.hallazgo.datos} />}

      <details className="mensaje-detalles">
        <summary>Por qué este mensaje</summary>
        <dl>
          <dt>Canal elegido</dt><dd>{m.motivo}</dd>
          <dt>Base científica</dt><dd>{m.hallazgo.fuente}</dd>
          <dt>Dato técnico</dt><dd>{m.hallazgo.detalleTecnico}</dd>
        </dl>
        {!m.escalamiento && m.hallazgo.nivel !== 'normal' && (
          <>
            <p className="detalles-sub">Cómo lo recibiría cada astronauta</p>
            <ul className="comparacion">
              {PERFILES.map((p) => (
                <li key={p.id}>
                  <strong>{p.nombre}</strong> <span className="texto-suave">· {p.rol}</span>
                  <p>{redactar(m.hallazgo, p, contexto, { breve: m.canal === 'auricular' })}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </li>
  );
}

/** Datos de semanas del hallazgo (y los que usa su regla aunque no los cite): su evolución en minigráficos. */
const TENDENCIA_POR_REGLA: Record<string, TipoSensor[]> = {
  'radiacion.dosis': ['dosisRadiacion'], 'hueso.perdida': ['minutosResistencia'], 'sueno.deficit': ['horasSueno'],
  'mental.animoSostenido': ['animo'], 'mental.animo': ['animo'],
};

function Tendencias({ mensaje: m, historial }: { mensaje: Mensaje; historial: Historial }) {
  if (m.escalamiento || m.hallazgo.nivel === 'normal') return null;
  const deDatos = (m.hallazgo.datos ?? []).map((d) => d.sensor).filter((s) => DATOS_CON_TENDENCIA.includes(s));
  const sensores = [...new Set([...(TENDENCIA_POR_REGLA[m.hallazgo.riesgoId] ?? []), ...deDatos])].slice(0, 2);
  if (!sensores.length) return null;
  const base = (s: TipoSensor) => m.hallazgo.datos?.find((d) => d.sensor === s && d.lineaBase !== undefined)?.lineaBase;
  return <div className="tendencias">{sensores.map((s) => <MiniTendencia key={s} sensor={s} historial={historial} base={base(s)} />)}</div>;
}

const horaDato = (ts: number) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const FUENTE: Record<DatoClinico['fuente'], string> = { sensor: 'sensor', voz: 'conversación', manual: 'manual', simulador: 'simulador' };

/** Datos exactos en que se basó el análisis: valor, cuándo, de dónde y la línea base de la persona. */
function DatosUsados({ datos }: { datos: DatoClinico[] }) {
  return (
    <div className="datos-usados">
      <p className="datos-usados-titulo"><Icono nombre="actividad" tamano={14} /> Datos usados en este análisis</p>
      <ul>
        {datos.map((d, i) => {
          const info = INFO_SENSOR[d.sensor];
          return (
            <li key={`${d.sensor}-${d.timestamp}-${i}`}>
              <span className="dato-nombre">{info.nombre}</span>
              <span className="dato-valor">{d.valor} {info.unidad}</span>
              {d.lineaBase !== undefined && <span className="texto-suave">habitual {d.lineaBase} {info.unidad}</span>}
              <span className="texto-suave">{horaDato(d.timestamp)} · {FUENTE[d.fuente]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
