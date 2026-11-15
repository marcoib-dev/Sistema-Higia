/**
 * COBERTURA DE RIESGOS DE LA NASA — los 18 riesgos del HRP en cinco columnas (los peligros del
 * vuelo espacial), con su estado en vivo. Es la pantalla que responde "¿qué riesgos cubren?".
 */
import { useEffect, useRef, useState } from 'react';
import type { Escenario } from '../../adaptadores/simulador/escenarios';
import { NOMBRE_PELIGRO, RIESGO_HRP, type IdRiesgoHRP } from '../../core/riesgosHRP';
import type { Nivel } from '../../core/tipos';
import { InsigniaNivel, NOMBRE_NIVEL } from '../componentes/basicos';
import { Icono } from '../iconos';
import { useT } from '../idioma';
import { COBERTURA, COLUMNAS, NOMBRE_CORTO_HRP, RIESGOS_CUBIERTOS, TOTAL_RIESGOS } from './cobertura';

type EstadoHRP = Record<IdRiesgoHRP, Nivel | 'sinDatos'>;

/** Orden de encendido: fila por fila, de izquierda a derecha (como se lee). */
const ORDEN: IdRiesgoHRP[] = Array.from({ length: Math.max(...COLUMNAS.map((c) => c.riesgos.length)) }, (_, f) => COLUMNAS.map((c) => c.riesgos[f]).filter((x): x is IdRiesgoHRP => !!x)).flat();

const sinMovimiento = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cuenta de 0 al total al montarse (1,2 s, con desaceleración). Sin animación si se pidió menos movimiento. */
function useConteo(total: number, ms = 1200): number {
  const [n, setN] = useState(() => (sinMovimiento() ? total : 0));
  useEffect(() => {
    if (sinMovimiento()) { setN(total); return; }
    let raf = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const x = Math.min(1, (t - t0) / ms);
      setN(Math.round(total * (1 - (1 - x) ** 3)));
      if (x < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [total, ms]);
  return n;
}

interface Props {
  estado: EstadoHRP;
  /** Riesgos que toca el escenario en curso: se resaltan. */
  enEscenario: IdRiesgoHRP[];
  onReproducir: (e: Escenario) => void;
  /** Vista para proyectar: sin tabla ni detalle, todo más grande. */
  grande?: boolean;
  onPantallaCompleta?: () => void;
}

export function CoberturaHRP({ estado, enEscenario, onReproducir, grande, onPantallaCompleta }: Props) {
  const t = useT();
  const [vista, setVista] = useState<'cuadricula' | 'tabla'>('cuadricula');
  const [abierto, setAbierto] = useState<IdRiesgoHRP | null>(null);
  const conteo = useConteo(RIESGOS_CUBIERTOS);

  return (
    <div className={`cobertura ${grande ? 'cobertura-grande' : ''}`}>
      <div className="cobertura-cab">
        <p className="cobertura-total" aria-label={t('{n} de {total} riesgos con detección', { n: RIESGOS_CUBIERTOS, total: TOTAL_RIESGOS })}>
          <span className="cobertura-numero" aria-hidden>{conteo}<span className="cobertura-de"> / {TOTAL_RIESGOS}</span></span>
          <span className="cobertura-texto" aria-hidden>{t('riesgos de salud de la NASA con detección')}</span>
        </p>
        {!grande && (
          <div className="cobertura-acciones">
            <div className="segmentado segmentado-iconos" role="radiogroup" aria-label={t('Vista')}>
              <button type="button" role="radio" aria-checked={vista === 'cuadricula'} onClick={() => setVista('cuadricula')} title={t('Cuadrícula')}>
                <Icono nombre="cuadricula" tamano={16} /><span className="sr-only">{t('Cuadrícula')}</span>
              </button>
              <button type="button" role="radio" aria-checked={vista === 'tabla'} onClick={() => setVista('tabla')} title={t('Tabla')}>
                <Icono nombre="tabla" tamano={16} /><span className="sr-only">{t('Tabla')}</span>
              </button>
            </div>
            {onPantallaCompleta && (
              <button className="boton" onClick={onPantallaCompleta}><Icono nombre="expandir" tamano={16} /> {t('Pantalla completa')}</button>
            )}
          </div>
        )}
      </div>

      {(vista === 'cuadricula' || grande) ? (
        <div className="cobertura-columnas">
          {COLUMNAS.map(({ peligro, riesgos }) => (
            <section key={peligro} className="cobertura-columna" aria-label={t(NOMBRE_PELIGRO[peligro])}>
              <h3>{t(NOMBRE_PELIGRO[peligro])}</h3>
              <ul>
                {riesgos.map((id) => {
                  const e = estado[id];
                  return (
                    <li key={id} style={{ '--orden': ORDEN.indexOf(id) } as React.CSSProperties}>
                      <button
                        // La clave incluye el estado: al cambiar, el mosaico se vuelve a montar y late una vez.
                        key={`${id}-${e}`}
                        className={`mosaico nivel-${e} ${enEscenario.includes(id) ? 'en-escenario' : ''} ${abierto === id ? 'abierto' : ''}`}
                        onClick={() => !grande && setAbierto(abierto === id ? null : id)}
                        aria-expanded={grande ? undefined : abierto === id}
                        disabled={grande}
                      >
                        <span className="mosaico-check" aria-hidden><Icono nombre="check" tamano={14} /></span>
                        <span className="mosaico-nombre">{NOMBRE_CORTO_HRP[id]}</span>
                        <span className="mosaico-estado">{e === 'sinDatos' ? t('Vigilando') : t(NOMBRE_NIVEL[e])}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <TablaCobertura estado={estado} onReproducir={onReproducir} />
      )}

      {abierto && !grande && vista === 'cuadricula' && (
        <DetalleRiesgo id={abierto} nivel={estado[abierto]} onReproducir={onReproducir} onCerrar={() => setAbierto(null)} />
      )}
    </div>
  );
}

function DetalleRiesgo({ id, nivel, onReproducir, onCerrar }: { id: IdRiesgoHRP; nivel: Nivel | 'sinDatos'; onReproducir: (e: Escenario) => void; onCerrar: () => void }) {
  const t = useT();
  const { riesgo, reglas, escenarios } = COBERTURA[id];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: sinMovimiento() ? 'auto' : 'smooth' }); }, [id]);
  return (
    <div ref={ref} className="detalle-riesgo" role="region" aria-label={t(riesgo.nombre)}>
      <div className="detalle-riesgo-cab">
        <div>
          <h3>{t(riesgo.nombre)}</h3>
          <p className="texto-suave">{t('§{n} del desafío ·', { n: riesgo.seccion })} {riesgo.peligros.map((p) => t(NOMBRE_PELIGRO[p])).join(' · ')}</p>
        </div>
        <InsigniaNivel nivel={nivel} />
        <button className="boton-icono" onClick={onCerrar} aria-label={t('Cerrar detalle')}><Icono nombre="cerrar" /></button>
      </div>
      <p>{t(riesgo.resumen)}</p>
      <p className="detalle-sub">{t('Reglas que lo vigilan')}</p>
      {reglas.length
        ? <ul className="lista-chips">{reglas.map((r) => <li key={r.id} title={r.fuente}>{t(r.nombre)}</li>)}</ul>
        : <p className="nota">{t('Se cubre con la guía paso a paso que trae toda alerta y con el modo sin conexión.')}</p>}
      {escenarios.length > 0 && (
        <>
          <p className="detalle-sub">{t('Escenarios que lo demuestran')}</p>
          <ul className="lista-chips">
            {escenarios.map((e) => (
              <li key={e.id}><button onClick={() => onReproducir(e)}><Icono nombre="reproducir" tamano={12} /> {t(e.nombre)}</button></li>
            ))}
          </ul>
        </>
      )}
      <a href={riesgo.url} target="_blank" rel="noreferrer" className="boton-enlace">{t('Página del riesgo en la NASA')} <Icono nombre="externo" tamano={14} /></a>
    </div>
  );
}

function TablaCobertura({ estado, onReproducir }: { estado: EstadoHRP; onReproducir: (e: Escenario) => void }) {
  const t = useT();
  return (
    <div className="tabla-cobertura-marco">
      <table className="tabla-cobertura">
        <thead>
          <tr><th scope="col">{t('Riesgo')}</th><th scope="col">§</th><th scope="col">{t('Estado')}</th><th scope="col">{t('Reglas')}</th><th scope="col">{t('Escenarios')}</th></tr>
        </thead>
        <tbody>
          {COLUMNAS.flatMap((c) => c.riesgos).map((id) => {
            const { riesgo, reglas, escenarios } = COBERTURA[id];
            return (
              <tr key={id}>
                <th scope="row"><a href={riesgo.url} target="_blank" rel="noreferrer">{t(RIESGO_HRP[id].nombre)}</a></th>
                <td className="num">{riesgo.seccion}</td>
                <td><InsigniaNivel nivel={estado[id]} /></td>
                <td className="num">{reglas.length || t('guía')}</td>
                <td>
                  {escenarios.slice(0, 2).map((e) => (
                    <button key={e.id} className="boton-enlace" onClick={() => onReproducir(e)}>{t(e.nombre)}</button>
                  ))}
                  {escenarios.length > 2 && <span className="texto-suave"> +{escenarios.length - 2}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Cuadrícula a pantalla completa, para proyectar o grabar. Esc cierra. */
export function CoberturaPantallaCompleta({ estado, enEscenario, onCerrar }: { estado: EstadoHRP; enEscenario: IdRiesgoHRP[]; onCerrar: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [onCerrar]);
  return (
    <div ref={ref} className="cobertura-pantalla" role="dialog" aria-modal="true" aria-label={t('Cobertura de riesgos de la NASA')} tabIndex={-1}>
      <button className="boton-icono cobertura-cerrar" onClick={onCerrar} aria-label={t('Cerrar pantalla completa (Esc)')}><Icono nombre="contraer" /></button>
      <CoberturaHRP estado={estado} enEscenario={enEscenario} onReproducir={() => {}} grande />
    </div>
  );
}
