import { useEffect, useState } from 'react';
import { detener, estadoVoz, fijarVolumen, motorSintesis, pausar, reanudar } from '../../adaptadores/voz/voz';
import { Icono } from '../iconos';

interface Props {
  vozActiva: boolean;
  onVozActiva: (v: boolean) => void;
}

/** Control de la voz de Higia: silenciar, pausar/reanudar, detener y volumen. */
export function ControlVoz({ vozActiva, onVozActiva }: Props) {
  const [estado, setEstado] = useState(estadoVoz());
  const [motor, setMotor] = useState(motorSintesis());
  const [volumen, setVolumen] = useState(1);

  useEffect(() => {
    const id = setInterval(() => { setEstado(estadoVoz()); setMotor(motorSintesis()); }, 300);
    return () => clearInterval(id);
  }, []);

  const texto = !vozActiva ? 'Voz silenciada' : estado === 'hablando' ? 'Hablando' : estado === 'pausada' ? 'En pausa' : 'Voz lista';

  return (
    <div
      className="control-voz" role="group" aria-label="Voz de Higia"
      title={motor === 'neuronal' ? 'Voz neuronal local (Piper): sin conexión' : motor === 'cargando' ? 'Cargando la voz neuronal local…' : 'Voz del navegador (la voz neuronal no está disponible)'}
    >
      <button
        className="boton-icono" onClick={() => { onVozActiva(!vozActiva); if (vozActiva) detener(); }}
        aria-pressed={!vozActiva} aria-label={vozActiva ? 'Silenciar voz' : 'Activar voz'} title={vozActiva ? 'Silenciar voz' : 'Activar voz'}
      >
        <Icono nombre={vozActiva ? 'volumen' : 'silencio'} />
      </button>
      <span className={`control-voz-estado ${vozActiva ? estado : 'silenciada'}`} aria-live="polite">{texto}</span>
      {estado === 'pausada'
        ? <button className="boton-icono" onClick={reanudar} aria-label="Reanudar" title="Reanudar"><Icono nombre="reproducir" /></button>
        : <button className="boton-icono" onClick={pausar} disabled={estado !== 'hablando'} aria-label="Pausar" title="Pausar"><Icono nombre="pausa" /></button>}
      <button className="boton-icono" onClick={detener} disabled={estado === 'callada'} aria-label="Detener (Esc)" title="Detener (Esc)">
        <Icono nombre="detener" />
      </button>
      <input
        className="control-voz-volumen" type="range" min={0} max={1} step={0.1} value={volumen} disabled={!vozActiva}
        onChange={(e) => { const v = Number(e.target.value); setVolumen(v); fijarVolumen(v); }} aria-label="Volumen"
      />
    </div>
  );
}
