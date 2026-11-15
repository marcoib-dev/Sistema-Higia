/** Estructura de la app: barra superior, navegación y aviso global de alerta. */
import { useEffect, useRef } from 'react';
import type { EstadoEscucha } from '../../adaptadores/voz/voz';
import type { Comunicacion, Contexto, Mensaje } from '../../core/tipos';
import { horaHabitat } from '../../core/momento';
import { TEXTO_ACTIVIDAD, TEXTO_ESCUCHA, type ActividadHigia } from '../asistente';
import { NOMBRE_DESTINO } from '../../core/tipos';
import { Icono } from '../iconos';
import { useIdioma, useT, SelectorIdioma } from '../idioma';
import { SECCIONES, type Seccion } from '../navegacion';
import { ControlVoz } from './ControlVoz';

const UBICACION: Record<Contexto['ubicacion'], string> = { habitat: 'Hábitat', eva: 'EVA', rover: 'Rover' };

interface PropsBarra {
  contexto: Contexto;
  nombreAstronauta: string;
  iaActiva: boolean;
  iaConfigurada: boolean;
  escucha: EstadoEscucha;
  actividad: ActividadHigia;
  ahora: number;
  vozActiva: boolean;
  onVozActiva: (v: boolean) => void;
  demoAbierta: boolean;
  onDemo: () => void;
}

export function BarraSuperior({ contexto: c, nombreAstronauta, iaActiva, iaConfigurada, escucha, actividad, ahora, vozActiva, onVozActiva, demoAbierta, onDemo }: PropsBarra) {
  const { t } = useIdioma();
  const atenta = actividad === 'escuchando' || actividad === 'pensando' || actividad === 'hablando';
  return (
    <header className="barra-superior">
      <div className="marca">
        <span className="marca-logo" role="img" aria-label="Higia">
          <svg className="marca-svg" viewBox="-6 -4 627 216" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <g transform="translate(0 0) scale(0.83333) translate(-850 -350)" fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M880 400 L1040 400 C1036 460 1000 490 960 492 C920 490 884 460 880 400 Z" />
              <path d="M960 492 L960 580" />
              <path d="M912 592 C930 578 990 578 1008 592 Z" />
              <path d="M1000 578 C944 580 930 556 968 548 C1004 540 1002 520 966 516 C928 512 902 506 878 478 C858 452 858 410 872 384 C884 362 912 356 930 368 C940 374 942 386 936 392" />
            </g>
            <path fill="currentColor" d="M195.88 166.28000000000003V40.28000000000003H219.64V92.30000000000003H266.44V40.28000000000003H290.2V166.28000000000003H266.44V113.90000000000003H219.64V166.28000000000003Z M308.56 166.28000000000003V40.28000000000003H332.32V166.28000000000003Z M394.24 168.80000000000004Q381.28000000000003 168.80000000000004 370.75 162.95000000000005Q360.22 157.10000000000002 354.01 145.85000000000002Q347.8 134.60000000000002 347.8 118.40000000000003V88.16000000000004Q347.8 63.86000000000003 361.48 50.81000000000004Q375.16 37.76000000000005 398.56 37.76000000000005Q421.78000000000003 37.76000000000005 434.47 50.09000000000004Q447.16 62.42000000000003 447.16 83.48000000000003V84.20000000000003H423.76V82.76000000000003Q423.76 76.10000000000004 420.97 70.70000000000005Q418.18 65.30000000000004 412.6 62.150000000000034Q407.02 59.00000000000003 398.56 59.00000000000003Q385.96000000000004 59.00000000000003 378.76 66.74000000000004Q371.56 74.48000000000003 371.56 87.80000000000003V118.76000000000003Q371.56 131.90000000000003 378.76 139.91000000000003Q385.96000000000004 147.92000000000002 398.92 147.92000000000002Q411.88 147.92000000000002 417.82 141.08000000000004Q423.76 134.24000000000004 423.76 123.80000000000004V122.00000000000003H393.88V101.84000000000003H447.16V166.28000000000003H425.2V154.22000000000003H421.96000000000004Q420.7 157.28000000000003 417.90999999999997 160.70000000000005Q415.12 164.12000000000003 409.54 166.46000000000004Q403.96000000000004 168.80000000000004 394.24 168.80000000000004Z M464.44 166.28000000000003V40.28000000000003H488.2V166.28000000000003Z M497.92 166.28000000000003 531.04 40.28000000000003H572.44L605.56 166.28000000000003H581.08L574.24 138.56000000000003H529.24L522.4 166.28000000000003ZM534.82 116.60000000000002H568.66L553.36 55.22000000000003H550.12Z" />
          </svg>
        </span>
      </div>

      <ul data-tutorial="indicadores" className="indicadores" aria-label={t('Estado del sistema')}>
        <li className={c.conexionHabitat ? 'ok' : ''} title={c.conexionHabitat ? t('Conectado al hábitat') : t('Sin conexión: todo se resuelve en el dispositivo')}>
          <Icono nombre={c.conexionHabitat ? 'conexion' : 'sinConexion'} tamano={16} />
          <span className="indicador-texto">{c.conexionHabitat ? t('Conectado') : t('Autónomo')}</span>
        </li>
        <li className={iaActiva ? 'ia' : ''} title={iaActiva ? t('IA activa (DeepSeek)') : iaConfigurada ? t('IA configurada') : t('IA no configurada: falta DEEPSEEK_API_KEY')}>
          <Icono nombre="ia" tamano={16} />
          <span className="indicador-texto">{iaActiva ? t('IA activa') : t('IA inactiva')}</span>
        </li>
        <li className={atenta ? `actividad-${actividad}` : `escucha-${escucha}`} title={atenta ? t(TEXTO_ACTIVIDAD[actividad]) : t(TEXTO_ESCUCHA[escucha])}>
          <Icono nombre={actividad === 'pensando' ? 'ia' : actividad === 'hablando' ? 'volumen' : 'microfono'} tamano={16} />
          <span className="indicador-texto">{atenta
            ? (actividad === 'escuchando' ? t('Te escucho') : actividad === 'pensando' ? t('Pensando') : t('Hablando'))
            : escucha === 'esperando' ? '«Higia»' : escucha === 'cargando' ? t('Voz local…') : escucha === 'error' ? t('Sin micrófono') : t('Escucha apagada')}</span>
        </li>
        <li title={t('Astronauta')}>
          <Icono nombre="usuario" tamano={16} />{nombreAstronauta}
        </li>
        <li title={t('Ubicación y destino')}>
          <Icono nombre="ubicacion" tamano={16} />{t(UBICACION[c.ubicacion])} · {t(NOMBRE_DESTINO[c.destino])}
        </li>
        <li title={`${t('Hora del hábitat')} · ${t('día {n} de misión', { n: c.diaMision })}`}>
          <Icono nombre="reloj" tamano={16} />{horaHabitat(c, ahora)}<span className="indicador-texto"> · {t('día {n}', { n: c.diaMision })}</span>
        </li>
        {c.climaEspacial === 'tormentaSolar' && (
          <li className="alerta" title={t('Tormenta solar activa')}><Icono nombre="sol" tamano={16} />{t('Tormenta solar')}</li>
        )}
      </ul>

      <div className="barra-acciones">
        <SelectorIdioma />
        <ControlVoz vozActiva={vozActiva} onVozActiva={onVozActiva} />
        <button data-tutorial="simulador" className={`boton boton-simulador ${demoAbierta ? 'boton-activo' : ''}`} onClick={onDemo} aria-expanded={demoAbierta} aria-controls="panel-simulador" title={t('Simulador (D)')}>
          <Icono nombre="demo" /> <span className="ocultar-movil">{t('Simulador')}</span>
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
  const t = useT();
  return (
    <nav data-tutorial="navegacion" className="navegacion" aria-label={t('Secciones')}>
      <ul>
        {SECCIONES.map((s) => (
          <li key={s.id}>
            <a
              href={`#/${s.id}`} aria-current={seccion === s.id ? 'page' : undefined}
              onClick={(e) => { e.preventDefault(); onIr(s.id); }} title={t(s.descripcion)}
            >
              <Icono nombre={s.icono} tamano={20} />
              <span className="navegacion-nombre">{t(s.nombre)}</span>
              {!!contadores[s.id] && <span className="contador" aria-label={`${contadores[s.id]} ${t('nuevos')}`}>{contadores[s.id]}</span>}
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
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const visible = pendientes.length > 0;
  // Publica su alto (--alto-banner) para que el panel del simulador y la navegación se acomoden debajo y nunca lo tapen.
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
  const plazo = Math.max(1, primera.vence - primera.mensaje.timestamp);
  const resta = Math.max(0, Math.min(1, (primera.vence - ahora) / plazo));
  return (
    <div ref={ref} className="banner-alerta" role="alert">
      <Icono nombre="alerta" tamano={22} />
      <div className="banner-texto">
        <strong>{t(primera.mensaje.hallazgo.titulo)}</strong>
        <span>
          {t('Si no respondes en')} <b className="cuenta">{segundos} s</b>{t(', Higia avisará a otros.')}
          {resto.length > 0 && ` ${t('Hay {n} alerta(s) más.', { n: resto.length })}`}
        </span>
      </div>
      <button className="boton boton-ok" onClick={() => onConfirmar(primera.mensaje.id)}>
        <Icono nombre="check" /> {t('Estoy bien')}
      </button>
      <button className="boton boton-fantasma" onClick={onVer}>{t('Ver detalle')}</button>
      <span className="banner-plazo" aria-hidden><span style={{ transform: `scaleX(${resta})` }} /></span>
    </div>
  );
}

const hora = (t: number, idioma: 'es' | 'en' = 'es') => new Date(t).toLocaleTimeString(idioma === 'en' ? 'en-GB' : 'es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
/** Lo que tarda en verse "entregado" tras enviar: el estado avanza a la vista. */
const MS_ENVIANDO = 1200;
type Etapa = 'enCola' | 'enviando' | 'entregado' | 'respondio';
const etapaDe = (x: Comunicacion, ahora: number): Etapa =>
  x.estado === 'enCola' ? 'enCola' : x.respuesta ? 'respondio' : ahora - x.timestamp < MS_ENVIANDO ? 'enviando' : 'entregado';
const ETAPAS: Exclude<Etapa, 'enCola'>[] = ['enviando', 'entregado', 'respondio'];
const NOMBRE_ETAPA: Record<Etapa, string> = { enCola: 'En cola: sale al reconectar', enviando: 'Enviando…', entregado: 'Entregado', respondio: 'Respondió' };

interface PropsComunicacion {
  mensaje: Mensaje;
  comunicaciones: Comunicacion[];
  ahora: number;
  onVer: () => void;
  onCerrar: () => void;
}

/**
 * Aviso global de comunicación con otros: aparece cuando Higia avisó a alguien (alerta sin respuesta
 * o pedido de ayuda) y muestra, en vivo, a quién y si ya respondió.
 */
export function BannerComunicacion({ mensaje, comunicaciones, ahora, onVer, onCerrar }: PropsComunicacion) {
  const { t, idioma } = useIdioma();
  const porEscalada = mensaje.escalamiento?.origen !== 'asistente';
  return (
    <div className="banner-comunicacion" role="status" aria-live="polite">
      <Icono nombre="escalado" tamano={22} />
      <div className="banner-texto">
        <strong>{porEscalada ? t('Sin respuesta a «{titulo}»: Higia avisó a otros', { titulo: mensaje.hallazgo.titulo }) : t('Pedido de ayuda enviado')}</strong>
        <ul className="banner-destinos">
          {comunicaciones.map((x) => {
            const etapa = etapaDe(x, ahora);
            const i = ETAPAS.indexOf(etapa as Exclude<Etapa, 'enCola'>);
            return (
              <li key={x.id} className={`com-${x.estado} etapa-${etapa}`}>
                <span className="com-destino">{x.destinatario}</span>
                {etapa !== 'enCola' && (
                  <ol className="com-etapas" aria-hidden>
                    {ETAPAS.map((e, j) => <li key={e} className={j < i ? 'hecha' : j === i ? 'actual' : ''} />)}
                  </ol>
                )}
                <span className="com-estado">
                  {x.respuesta ? x.respuesta.texto : t(NOMBRE_ETAPA[etapa])}
                  <span className="com-hora"> · {hora(x.respuesta?.timestamp ?? x.timestamp, idioma)}{x.retardo && x.estado === 'enviado' ? ` · ${t('retardo')} ${x.retardo}` : ''}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <button className="boton boton-fantasma" onClick={onVer}>{t('Ver comunicaciones')}</button>
      <button className="boton-icono" onClick={onCerrar} aria-label={t('Cerrar aviso')}><Icono nombre="cerrar" /></button>
    </div>
  );
}
