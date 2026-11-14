/** Estructura de la app: barra superior, navegación y aviso global de alerta. */
import { useEffect, useRef } from 'react';
import type { Contexto, Mensaje } from '../../core/tipos';
import { NOMBRE_DESTINO } from '../../core/tipos';
import { Icono } from '../iconos';
import { SECCIONES, type Seccion } from '../navegacion';
import { ControlVoz } from './ControlVoz';

const UBICACION: Record<Contexto['ubicacion'], string> = { habitat: 'Hábitat', eva: 'EVA', rover: 'Rover' };

interface PropsBarra {
  contexto: Contexto;
  nombreAstronauta: string;
  iaActiva: boolean;
  iaConfigurada: boolean;
  vozActiva: boolean;
  onVozActiva: (v: boolean) => void;
  demoAbierta: boolean;
  onDemo: () => void;
}

export function BarraSuperior({ contexto: c, nombreAstronauta, iaActiva, iaConfigurada, vozActiva, onVozActiva, demoAbierta, onDemo }: PropsBarra) {
  return (
    <header className="barra-superior">
      <div className="marca">
        <span className="marca-logo" aria-hidden><Icono nombre="actividad" tamano={18} /></span>
        <span className="marca-nombre">Higia</span>
      </div>

      <ul className="indicadores" aria-label="Estado del sistema">
        <li className={c.conexionHabitat ? 'ok' : ''} title={c.conexionHabitat ? 'Conectado al hábitat' : 'Sin conexión: todo se resuelve en el dispositivo'}>
          <Icono nombre={c.conexionHabitat ? 'conexion' : 'sinConexion'} tamano={16} />
          <span className="indicador-texto">{c.conexionHabitat ? 'Conectado' : 'Autónomo'}</span>
        </li>
        <li className={iaActiva ? 'ia' : ''} title={iaActiva ? 'IA activa' : iaConfigurada ? 'La IA se activa con conexión al hábitat' : 'IA no configurada'}>
          <Icono nombre="ia" tamano={16} />
          <span className="indicador-texto">{iaActiva ? 'IA activa' : 'IA inactiva'}</span>
        </li>
        <li title="Astronauta">
          <Icono nombre="usuario" tamano={16} />{nombreAstronauta}
        </li>
        <li title="Ubicación y destino">
          <Icono nombre="ubicacion" tamano={16} />{UBICACION[c.ubicacion]} · {NOMBRE_DESTINO[c.destino]}
        </li>
        <li title="Hora del hábitat">
          <Icono nombre="reloj" tamano={16} />{String(c.hora).padStart(2, '0')}:00
        </li>
        {c.climaEspacial === 'tormentaSolar' && (
          <li className="alerta" title="Tormenta solar activa"><Icono nombre="sol" tamano={16} />Tormenta solar</li>
        )}
      </ul>

      <div className="barra-acciones">
        <ControlVoz vozActiva={vozActiva} onVozActiva={onVozActiva} />
        <button className={`boton ${demoAbierta ? 'boton-activo' : ''}`} onClick={onDemo} aria-expanded={demoAbierta} aria-controls="panel-demo" title="Controles de la demo (D)">
          <Icono nombre="demo" /> <span className="ocultar-movil">Demo</span>
        </button>
      </div>
    </header>
  );
}

interface PropsNav {
  seccion: Seccion;
  onIr: (s: Seccion) => void;
  /** Número a mostrar sobre cada sección (p. ej. mensajes nuevos). */
  contadores: Partial<Record<Seccion, number>>;
}

export function Navegacion({ seccion, onIr, contadores }: PropsNav) {
  return (
    <nav className="navegacion" aria-label="Secciones">
      <ul>
        {SECCIONES.map((s) => (
          <li key={s.id}>
            <a
              href={`#/${s.id}`} aria-current={seccion === s.id ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); onIr(s.id); }} title={s.descripcion}
            >
              <Icono nombre={s.icono} tamano={20} />
              <span className="navegacion-nombre">{s.nombre}</span>
              {!!contadores[s.id] && <span className="contador" aria-label={`${contadores[s.id]} nuevos`}>{contadores[s.id]}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface PropsBanner {
  /** Alertas esperando "Estoy bien", con su vencimiento. */
  pendientes: { mensaje: Mensaje; vence: number }[];
  ahora: number;
  onConfirmar: (id: string) => void;
  onVer: () => void;
}

/** Aviso global: la acción más crítica siempre a la vista, en cualquier sección. */
export function BannerAlerta({ pendientes, ahora, onConfirmar, onVer }: PropsBanner) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = pendientes.length > 0;
  // Publica su alto (--alto-banner) para que el panel de demo y la navegación se acomoden debajo y nunca lo tapen.
  useEffect(() => {
    const raiz = document.documentElement;
    if (!visible || !ref.current) { raiz.style.setProperty('--alto-banner', '0px'); return; }
    const ro = new ResizeObserver(([e]) => raiz.style.setProperty('--alto-banner', `${e.target.getBoundingClientRect().height}px`));
    ro.observe(ref.current);
    return () => { ro.disconnect(); raiz.style.setProperty('--alto-banner', '0px'); };
  }, [visible]);
  if (!visible) return null;
  const [primera, ...resto] = [...pendientes].sort((a, b) => a.vence - b.vence);
  const segundos = Math.max(0, Math.ceil((primera.vence - ahora) / 1000));
  return (
    <div ref={ref} className="banner-alerta" role="alert">
      <Icono nombre="alerta" tamano={22} />
      <div className="banner-texto">
        <strong>{primera.mensaje.hallazgo.titulo}</strong>
        <span>
          Si no respondes en <b className="cuenta">{segundos} s</b>, Higia avisará a otros.
          {resto.length > 0 && ` Hay ${resto.length} alerta(s) más.`}
        </span>
      </div>
      <button className="boton boton-ok" onClick={() => onConfirmar(primera.mensaje.id)}>
        <Icono nombre="check" /> Estoy bien
      </button>
      <button className="boton boton-fantasma" onClick={onVer}>Ver detalle</button>
    </div>
  );
}
