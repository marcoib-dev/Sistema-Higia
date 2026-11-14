import type { Canal, Mensaje } from '../core/tipos';
import { COLOR_NIVEL, NOMBRE_NIVEL } from './FiguraCorporal';

export const NOMBRE_CANAL: Record<Canal, string> = {
  pantallaHabitat: '🖥 Pantalla del hábitat',
  pantallaPersonal: '📱 Pantalla personal',
  auricular: '🎧 Auricular',
  figura: '🧍 Solo figura',
};

export function PanelMensajes({ mensajes }: { mensajes: Mensaje[] }) {
  if (!mensajes.length) {
    return <p className="vacio">Sin mensajes todavía. Ejecuta un escenario del simulador.</p>;
  }
  return (
    <ol className="mensajes">
      {mensajes.map((m) => (
        <li key={m.id} className={`mensaje ${m.diferido ? 'diferido' : ''}`} style={{ borderColor: COLOR_NIVEL[m.hallazgo.nivel] }}>
          <div className="mensaje-cab">
            <span className="chip" style={{ background: COLOR_NIVEL[m.hallazgo.nivel] }}>{NOMBRE_NIVEL[m.hallazgo.nivel]}</span>
            <span className="chip chip-borde">{NOMBRE_CANAL[m.canal]}</span>
            {m.diferido && <span className="chip chip-borde">⏸ Retenido</span>}
            {m.hallazgo.sensible && <span className="chip chip-borde">🔒 Sensible</span>}
            {m.esRecordatorio && <span className="chip chip-borde">↻ Recordatorio</span>}
            <time>{new Date(m.timestamp).toLocaleTimeString('es')}</time>
          </div>
          <p className="mensaje-texto">{m.texto}</p>
          {m.reporte && <p className="mensaje-reporte">📡 {m.reporte}</p>}
          <p className="mensaje-motivo">Por qué este canal: {m.motivo}</p>
          <p className="mensaje-fuente">Fuente: {m.hallazgo.fuente}</p>
        </li>
      ))}
    </ol>
  );
}
