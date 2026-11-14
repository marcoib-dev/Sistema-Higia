import { useEffect, useState } from 'react';
import { detener, estadoVoz, fijarVolumen, pausar, reanudar } from '../adaptadores/voz/voz';

interface Props {
  vozActiva: boolean;
  onVozActiva: (v: boolean) => void;
}

/** Barra de control de la voz: pausar/reanudar, detener, volumen y silenciar. Esc detiene. */
export function ControlVoz({ vozActiva, onVozActiva }: Props) {
  const [estado, setEstado] = useState(estadoVoz());
  const [volumen, setVolumen] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setEstado(estadoVoz()), 300);
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') detener(); };
    window.addEventListener('keydown', alTeclear);
    return () => { clearInterval(id); window.removeEventListener('keydown', alTeclear); };
  }, []);

  const cambiarVolumen = (v: number) => {
    setVolumen(v);
    fijarVolumen(v);
  };

  return (
    <div className="control-voz" role="group" aria-label="Control de voz">
      <span className={`indicador-voz ${estado}`} aria-live="polite">
        {estado === 'hablando' ? '🔊 Hablando' : estado === 'pausada' ? '⏸ En pausa' : '🔈 En silencio'}
      </span>
      {estado === 'pausada'
        ? <button onClick={reanudar} aria-label="Reanudar voz">▶</button>
        : <button onClick={pausar} disabled={estado !== 'hablando'} aria-label="Pausar voz">⏸</button>}
      <button onClick={detener} disabled={estado === 'callada'} aria-label="Detener voz (Esc)" title="Detener (Esc)">⏹</button>
      <input
        type="range" min={0} max={1} step={0.1} value={volumen}
        onChange={(e) => cambiarVolumen(Number(e.target.value))} aria-label="Volumen"
      />
      <label className="interruptor">
        <input type="checkbox" checked={vozActiva} onChange={(e) => { onVozActiva(e.target.checked); if (!e.target.checked) detener(); }} />
        Voz
      </label>
    </div>
  );
}
