import type { Canal, Mensaje } from '../core/tipos';
import { COLOR_NIVEL, NOMBRE_NIVEL } from './FiguraCorporal';

export const NOMBRE_CANAL: Record<Canal, string> = {
  pantallaHabitat: '🖥 Pantalla del hábitat',
  pantallaPersonal: '📱 Pantalla personal',
  auricular: '🎧 Auricular',
  figura: '🧍 Solo figura',
};

interface Props {
  mensajes: Mensaje[];
  /** id del mensaje → instante en que vence la confirmación */
  pendientes: Map<string, number>;
  ahora: number;
  onConfirmar: (id: string) => void;
}

export function PanelMensajes({ mensajes, pendientes, ahora, onConfirmar }: Props) {
  if (!mensajes.length) {
    return <p className="vacio">Sin mensajes todavía. Ejecuta un escenario del simulador.</p>;
  }
  return (
    <ol className="mensajes">
      {mensajes.map((m) => {
        const vence = pendientes.get(m.id);
        const segundos = vence ? Math.max(0, Math.ceil((vence - ahora) / 1000)) : 0;
        return (
          <li
            key={m.id}
            className={`mensaje ${m.diferido ? 'diferido' : ''} ${m.escalamiento ? 'escalado' : ''}`}
            style={{ borderColor: COLOR_NIVEL[m.hallazgo.nivel] }}
          >
            <div className="mensaje-cab">
              {m.escalamiento
                ? <span className="chip" style={{ background: COLOR_NIVEL.alerta }}>🚨 Escalado</span>
                : <span className="chip" style={{ background: COLOR_NIVEL[m.hallazgo.nivel] }}>{NOMBRE_NIVEL[m.hallazgo.nivel]}</span>}
              <span className="chip chip-borde">{NOMBRE_CANAL[m.canal]}</span>
              {m.diferido && <span className="chip chip-borde">⏸ Retenido</span>}
              {m.hallazgo.sensible && <span className="chip chip-borde">🔒 Sensible</span>}
              {m.esRecordatorio && <span className="chip chip-borde">↻ Recordatorio</span>}
              <time>{new Date(m.timestamp).toLocaleTimeString('es')}</time>
            </div>

            <p className="mensaje-texto">{m.texto}</p>

            {vence !== undefined && (
              <div className="confirmacion">
                <button className="boton-ok" onClick={() => onConfirmar(m.id)}>✋ Estoy bien</button>
                <span>Si no respondes, se avisa a otros en <strong>{segundos} s</strong>.</span>
              </div>
            )}

            {m.escalamiento && (
              <p className="mensaje-reporte">📡 Avisados: {m.escalamiento.destinos.join(' · ')}</p>
            )}

            {m.pasos && (
              <div className="pasos">
                <p>Guía paso a paso (no hay médico a bordo):</p>
                <ol>{m.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
              </div>
            )}

            {m.reporte && <p className="mensaje-reporte">📡 {m.reporte}</p>}
            <p className="mensaje-motivo">Por qué este canal: {m.motivo}</p>
            <p className="mensaje-fuente">Fuente: {m.hallazgo.fuente}</p>
          </li>
        );
      })}
    </ol>
  );
}
