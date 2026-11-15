/**
 * BARRA DE REPRODUCCIÓN — fija abajo mientras hay un escenario cargado, aunque el panel esté cerrado.
 * Narración del paso, progreso por pasos, cuenta al siguiente y controles. Publica su alto en
 * --alto-reproductor para que nada quede tapado.
 */
import { useEffect, useRef } from 'react';
import type { Velocidad } from '../../adaptadores/simulador/reproductor';
import { Icono } from '../iconos';
import { useT } from '../idioma';
import type { Simulador } from './useSimulador';

/** Atajos del reproductor (Espacio, N, R). Devuelve true si la tecla se usó. */
export function teclaReproductor(e: React.KeyboardEvent, sim: Simulador): boolean {
  const t = e.target as HTMLElement;
  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return false;
  if (!sim.activo || e.metaKey || e.ctrlKey || e.altKey) return false;
  const r = sim.reproductor;
  if (e.key === ' ' && t.tagName !== 'BUTTON') { sim.control(r.estado === 'reproduciendo' ? 'pausar' : 'continuar'); return true; }
  if (e.key.toLowerCase() === 'n') { sim.control('siguiente'); return true; }
  if (e.key.toLowerCase() === 'r') { sim.control('reiniciar'); return true; }
  return false;
}

export function BarraReproduccion({ sim }: { sim: Simulador }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const r = sim.reproductor;
  const visible = sim.activo && !!r.escenario;

  useEffect(() => {
    const raiz = document.documentElement;
    if (!visible || !ref.current) { raiz.style.setProperty('--alto-reproductor', '0px'); return; }
    const ro = new ResizeObserver(([e]) => raiz.style.setProperty('--alto-reproductor', `${e.target.getBoundingClientRect().height}px`));
    ro.observe(ref.current);
    return () => { ro.disconnect(); raiz.style.setProperty('--alto-reproductor', '0px'); };
  }, [visible]);

  if (!visible) return null;
  const e = r.escenario!;
  const total = e.pasos.length;
  const ms = r.msHastaSiguiente;
  const terminado = r.estado === 'terminado';
  const pausado = r.estado === 'pausado';
  const narracion = r.esperando
    ? t('No toques «Estoy bien»: Higia escalará la alerta cuando venza el plazo.')
    : r.paso?.narracion ? t(r.paso.narracion) : (pausado ? t('Listo para empezar: toca «Siguiente paso».') : t('Preparando el escenario…'));
  const proximo = r.cola[0];

  return (
    <div ref={ref} className="barra-reproduccion" role="region" aria-label={t('Reproducción del escenario')} onKeyDown={(ev) => { if (teclaReproductor(ev, sim)) ev.preventDefault(); }}>
      <div className="reproduccion-info">
        <p className="reproduccion-titulo">
          <span className={`reproduccion-estado estado-${r.esperando ? 'esperando' : r.estado}`} aria-hidden />
          <strong>{t(e.nombre)}</strong>
          <span className="texto-suave">
            {terminado ? ` · ${t('Terminado')}` : r.indicePaso >= 0 ? ` · ${t('Paso {n} de {total}: {titulo}', { n: r.indicePaso + 1, total, titulo: t(r.paso!.titulo) })}` : ` · ${t('{n} paso(s)', { n: total })}`}
          </span>
        </p>
        <p className={`reproduccion-narracion ${r.esperando ? 'esperando' : ''}`} aria-live="polite">
          {terminado && proximo ? t('Sigue en el guion: {x}. Toca «Siguiente».', { x: t(proximo.nombre) }) : terminado ? t('El escenario terminó. Puedes reiniciarlo o elegir otro.') : narracion}
        </p>
        <ol className="reproduccion-pasos" aria-label={t('Progreso: paso {n} de {total}', { n: Math.max(0, r.indicePaso + 1), total })}>
          {e.pasos.map((p, i) => (
            <li key={i} className={i < r.indicePaso || terminado ? 'hecho' : i === r.indicePaso ? 'actual' : ''} title={t(p.titulo)} />
          ))}
        </ol>
      </div>

      <div className="reproduccion-controles">
        {ms !== null && !terminado && <span className="reproduccion-cuenta" title={t('Hasta el siguiente paso')}>{Math.ceil(ms / 1000)} s</span>}
        <button className="boton-icono" onClick={() => sim.control(r.estado === 'reproduciendo' ? 'pausar' : 'continuar')}
          aria-label={r.estado === 'reproduciendo' ? t('Pausar (Espacio)') : t('Continuar (Espacio)')} disabled={terminado && !proximo}>
          <Icono nombre={r.estado === 'reproduciendo' ? 'pausa' : 'reproducir'} />
        </button>
        <button className="boton-icono" onClick={() => sim.control('siguiente')} aria-label={t('Siguiente paso (N)')} disabled={terminado && !proximo}>
          <Icono nombre="siguiente" />
        </button>
        <button className="boton-icono" onClick={() => sim.control('reiniciar')} aria-label={t('Reiniciar escenario (R)')}><Icono nombre="reiniciar" /></button>
        <div className="segmentado segmentado-mini" role="radiogroup" aria-label={t('Velocidad')}>
          {([1, 2, 4] as Velocidad[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={r.velocidad === v} onClick={() => sim.cambiarVelocidad(v)}>×{v}</button>
          ))}
        </div>
        <button className="boton-icono" onClick={() => sim.control('detener')} aria-label={t('Cerrar escenario')}><Icono nombre="cerrar" /></button>
      </div>
    </div>
  );
}
