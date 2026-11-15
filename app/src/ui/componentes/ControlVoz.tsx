import { useEffect, useState } from 'react';
import { detener, estadoVoz, fijarVolumen, motorSintesis, pausar, reanudar } from '../../adaptadores/voz/voz';
import { Icono } from '../iconos';
import { useT } from '../idioma';

interface Props {
  vozActiva: boolean;
  onVozActiva: (v: boolean) => void;
}

/** Control de la voz de Higia: silenciar, pausar/reanudar, detener y volumen. */
export function ControlVoz({ vozActiva, onVozActiva }: Props) {
  const t = useT();
  const [estado, setEstado] = useState(estadoVoz());
  const [motor, setMotor] = useState(motorSintesis());
  const [volumen, setVolumen] = useState(1);

  useEffect(() => {
    const id = setInterval(() => { setEstado(estadoVoz()); setMotor(motorSintesis()); }, 300);
    return () => clearInterval(id);
  }, []);

  const texto = !vozActiva ? t('Voz silenciada') : estado === 'hablando' ? t('Hablando') : estado === 'pausada' ? t('En pausa') : t('Voz lista');

  return (
    <div
      data-tutorial="voz" className={`control-voz ${vozActiva && (estado === 'hablando' || estado === 'pausada') ? 'con-voz' : ''}`} role="group" aria-label={t('Voz de Higia')}
      title={motor === 'neuronal' ? t('Voz neuronal local (Piper): sin conexión') : motor === 'cargando' ? t('Cargando la voz neuronal local…') : t('Voz del navegador (la voz neuronal no está disponible)')}
    >
      <button
        className="boton-icono" onClick={() => { onVozActiva(!vozActiva); if (vozActiva) detener(); }}
        aria-pressed={!vozActiva} aria-label={vozActiva ? t('Silenciar voz') : t('Activar voz')} title={vozActiva ? t('Silenciar voz') : t('Activar voz')}
      >
        <Icono nombre={vozActiva ? 'volumen' : 'silencio'} />
      </button>
      <span className={`control-voz-estado ${vozActiva ? estado : 'silenciada'}`} aria-live="polite">{texto}</span>
      {estado === 'pausada'
        ? <button className="boton-icono control-voz-reproduccion" onClick={reanudar} aria-label={t('Reanudar')} title={t('Reanudar')}><Icono nombre="reproducir" /></button>
        : <button className="boton-icono control-voz-reproduccion" onClick={pausar} disabled={estado !== 'hablando'} aria-label={t('Pausar')} title={t('Pausar')}><Icono nombre="pausa" /></button>}
      <button className="boton-icono control-voz-reproduccion" onClick={detener} disabled={estado === 'callada'} aria-label={t('Detener (Esc)')} title={t('Detener (Esc)')}>
        <Icono nombre="detener" />
      </button>
      <input
        className="control-voz-volumen" type="range" min={0} max={1} step={0.1} value={volumen} disabled={!vozActiva}
        onChange={(e) => { const v = Number(e.target.value); setVolumen(v); fijarVolumen(v); }} aria-label={t('Volumen')}
      />
    </div>
  );
}
