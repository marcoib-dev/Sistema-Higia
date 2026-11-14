import { useState } from 'react';
import { PERFILES } from '../../adaptadores/simulador/perfiles';
import { redactar } from '../../core/personalizador';
import type { Contexto, Mensaje } from '../../core/tipos';
import { CANAL, EncabezadoSeccion, Etiqueta, InsigniaNivel, sinTitulo, Vacio } from '../componentes/basicos';
import { Icono } from '../iconos';

type Filtro = 'todos' | 'alertas' | 'retenidos' | 'escalados';

const FILTROS: { id: Filtro; nombre: string; aplica: (m: Mensaje) => boolean }[] = [
  { id: 'todos', nombre: 'Todos', aplica: () => true },
  { id: 'alertas', nombre: 'Alertas', aplica: (m) => m.hallazgo.nivel === 'alerta' && !m.escalamiento },
  { id: 'retenidos', nombre: 'Retenidos', aplica: (m) => m.diferido },
  { id: 'escalados', nombre: 'Escalados', aplica: (m) => !!m.escalamiento },
];

interface Props {
  mensajes: Mensaje[];
  pendientes: Map<string, number>;
  ahora: number;
  contexto: Contexto;
  onConfirmar: (id: string) => void;
  onAbrirDemo: () => void;
}

export function VistaMensajes({ mensajes, pendientes, ahora, contexto, onConfirmar, onAbrirDemo }: Props) {
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
          {!mensajes.length && <>Higia solo habla cuando algo cambia. <button className="boton-enlace" onClick={onAbrirDemo}>Ejecuta un escenario</button> para ver cómo responde.</>}
        </Vacio>
      ) : (
        <ol className="lista-mensajes">
          {visibles.map((m) => (
            <TarjetaMensaje key={m.id} mensaje={m} vence={pendientes.get(m.id)} ahora={ahora} contexto={contexto} onConfirmar={onConfirmar} />
          ))}
        </ol>
      )}
    </>
  );
}

function TarjetaMensaje({ mensaje: m, vence, ahora, contexto, onConfirmar }: {
  mensaje: Mensaje; vence?: number; ahora: number; contexto: Contexto; onConfirmar: (id: string) => void;
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

      <div className="mensaje-etiquetas">
        <Etiqueta icono={canal.icono}>{canal.nombre}</Etiqueta>
        {m.diferido && <Etiqueta icono="retenido">Retenido</Etiqueta>}
        {m.hallazgo.sensible && <Etiqueta icono="candado">Privado</Etiqueta>}
        {m.esRecordatorio && <Etiqueta icono="recordatorio">Recordatorio</Etiqueta>}
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

      {m.pasos && (
        <div className="pasos">
          <p>Qué hacer, paso a paso (no hay médico a bordo)</p>
          <ol>{m.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      )}

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
