/**
 * RECORRIDO GUIADO — burbujas que señalan, una por una, las partes principales de la app.
 *
 * Cada paso apunta a un elemento marcado con `data-tutorial="<ancla>"`. La burbuja se ubica sola del
 * lado donde cabe (abajo, arriba, a la derecha o a la izquierda) con su flecha hacia el elemento, y un
 * foco ilumina el elemento oscureciendo el resto. Si un paso vive en otra sección, el recorrido navega
 * hasta ella; si su elemento no está a la vista (p. ej. oculto en el móvil), se salta.
 *
 * Se muestra sola la primera vez (después de elegir el idioma) y se puede repetir desde «Cómo usar Higia».
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icono, type NombreIcono } from '../iconos';
import { useT } from '../idioma';
import type { Seccion } from '../navegacion';

type Lado = 'abajo' | 'arriba' | 'derecha' | 'izquierda';

interface Paso {
  ancla: string;
  icono: NombreIcono;
  titulo: string;
  texto: string;
  /** Detalle extra en letra pequeña (atajos, consejos). */
  nota?: string;
  /** Lado preferido para la burbuja; si no cabe, se prueba el opuesto y luego los demás. */
  lado: Lado;
  /** Sección donde está el elemento: el recorrido navega hasta ella. */
  seccion?: Seccion;
}

export const PASOS_TUTORIAL: Paso[] = [
  {
    ancla: 'simulador', icono: 'demo', lado: 'abajo',
    titulo: 'Empieza por el simulador',
    texto: 'Higia todavía no tiene sensores reales conectados. Ábrelo para lanzar escenarios (fiebre, un golpe en una EVA, una tormenta solar) y mira cómo reacciona.',
    nota: 'Atajo: tecla D',
  },
  {
    ancla: 'indicadores', icono: 'actividad', lado: 'abajo',
    titulo: 'El estado de un vistazo',
    texto: 'Conexión con el hábitat, IA, micrófono, astronauta, ubicación y hora de la misión. Pasa el mouse sobre cada uno para ver más.',
  },
  {
    ancla: 'voz', icono: 'volumen', lado: 'abajo',
    titulo: 'Controla su voz',
    texto: 'Pausa, detén o silencia a Higia cuando no quieras escucharla.',
    nota: 'Esc también la calla',
  },
  {
    ancla: 'idioma', icono: 'entorno', lado: 'abajo',
    titulo: 'Español o inglés',
    texto: 'Cambia el idioma cuando quieras: se guarda en este dispositivo.',
  },
  {
    ancla: 'navegacion', icono: 'cuadricula', lado: 'derecha',
    titulo: 'Todas las secciones',
    texto: 'Resumen del cuerpo, pruebas a bordo, mensajes, comunicaciones, perfil, entorno y reportes.',
  },
  {
    ancla: 'ayuda', icono: 'alerta', lado: 'abajo', seccion: 'asistente',
    titulo: 'Si algo va mal',
    texto: 'Pedir ayuda avisa de inmediato a los demás, aunque no puedas hablar.',
  },
  {
    ancla: 'sistemas', icono: 'resumen', lado: 'abajo', seccion: 'resumen',
    titulo: 'El cuerpo por sistemas',
    texto: 'Elige un sistema para ver solo sus órganos. El color marca su estado: verde normal, ámbar aviso y rojo alerta. El sistema inmune se muestra con métricas.',
  },
  {
    ancla: 'acceso-higia', icono: 'asistente', lado: 'arriba', seccion: 'resumen',
    titulo: 'Higia siempre a mano',
    texto: 'Desde cualquier sección puedes hablarle o escribirle aquí.',
  },
  {
    ancla: 'recorrido', icono: 'brujula', lado: 'abajo',
    titulo: 'Vuelve a verlo cuando quieras',
    texto: 'Este botón repite el recorrido desde cualquier sección.',
  },
];

const CLAVE = 'higia.tutorial';
export const tutorialVisto = (): boolean => {
  try { return localStorage.getItem(CLAVE) === 'visto'; } catch { return true; }
};
const marcarVisto = () => { try { localStorage.setItem(CLAVE, 'visto'); } catch { /* sin almacenamiento */ } };

/** Margen con el borde de la pantalla, separación con el elemento (incluye la flecha) y holgura del foco. */
const MARGEN = 12;
const SEPARACION = 16;
const HOLGURA = 6;
/** Tiempo máximo esperando que aparezca el elemento de un paso antes de saltarlo. */
const ESPERA_MS = 1500;

interface Caja { x: number; y: number; w: number; h: number }
interface Ubicacion { lado: Lado; left: number; top: number; flecha: number }

const OPUESTO: Record<Lado, Lado> = { abajo: 'arriba', arriba: 'abajo', derecha: 'izquierda', izquierda: 'derecha' };
const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Elige el lado donde cabe la burbuja y la centra respecto al elemento sin salirse de la pantalla. */
export function ubicarBurbuja(r: Caja, b: { w: number; h: number }, preferido: Lado, vw: number, vh: number): Ubicacion {
  const cabe: Record<Lado, boolean> = {
    abajo: r.y + r.h + SEPARACION + b.h <= vh - MARGEN,
    arriba: r.y - SEPARACION - b.h >= MARGEN,
    derecha: r.x + r.w + SEPARACION + b.w <= vw - MARGEN,
    izquierda: r.x - SEPARACION - b.w >= MARGEN,
  };
  const orden: Lado[] = [preferido, OPUESTO[preferido], ...(['abajo', 'arriba', 'derecha', 'izquierda'] as Lado[])];
  const lado = orden.find((l) => cabe[l]) ?? 'abajo';
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  if (lado === 'abajo' || lado === 'arriba') {
    const left = limitar(cx - b.w / 2, MARGEN, Math.max(MARGEN, vw - MARGEN - b.w));
    const top = lado === 'abajo'
      ? Math.min(r.y + r.h + SEPARACION, vh - MARGEN - b.h)
      : Math.max(r.y - SEPARACION - b.h, MARGEN);
    return { lado, left, top, flecha: limitar(cx - left, 22, b.w - 22) };
  }
  const top = limitar(cy - b.h / 2, MARGEN, Math.max(MARGEN, vh - MARGEN - b.h));
  const left = lado === 'derecha' ? r.x + r.w + SEPARACION : r.x - SEPARACION - b.w;
  return { lado, left, top, flecha: limitar(cy - top, 22, b.h - 22) };
}

const visible = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0 || getComputedStyle(el).visibility === 'hidden') return false;
  // Un grupo cuyos elementos están todos ocultos (p. ej. los indicadores en una pantalla muy angosta) no se señala.
  return !el.children.length || [...el.children].some((c) => c.getBoundingClientRect().width > 0);
};

interface Props {
  abierto: boolean;
  seccion: Seccion;
  onIr: (s: Seccion) => void;
  onCerrar: () => void;
}

export function Tutorial({ abierto, seccion, onIr, onCerrar }: Props) {
  const t = useT();
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [pos, setPos] = useState<Ubicacion | null>(null);
  const burbuja = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  /** Hacia dónde se avanza: si el elemento de un paso no aparece, se salta en esa dirección. */
  const direccion = useRef<1 | -1>(1);
  const seccionInicial = useRef(seccion);
  const paso = PASOS_TUTORIAL[i];
  const ultimo = i === PASOS_TUTORIAL.length - 1;

  // Al abrir: primer paso y se recuerda dónde estaba la persona para volver al terminar.
  useEffect(() => {
    if (!abierto) return;
    setI(0);
    direccion.current = 1;
    seccionInicial.current = seccion;
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = useCallback((completo: boolean) => {
    marcarVisto();
    setCaja(null);
    setPos(null);
    if (completo || seccionInicial.current !== seccion) onIr(seccionInicial.current);
    onCerrar();
  }, [onCerrar, onIr, seccion]);

  const ir = useCallback((d: 1 | -1) => {
    direccion.current = d;
    const n = i + d;
    if (n >= PASOS_TUTORIAL.length) cerrar(true);
    else setI(Math.max(0, n));
  }, [cerrar, i]);

  // Navega a la sección del paso, centra el elemento y lo sigue cada cuadro (scroll, cambios de tamaño, animaciones).
  useEffect(() => {
    if (!abierto || !paso) return;
    if (paso.seccion && paso.seccion !== seccion) onIr(paso.seccion);
    setCaja(null); // sin restos del paso anterior mientras se ubica el nuevo
    const inicio = performance.now();
    let centrado = false;
    let cuadro = 0;
    const seguir = () => {
      const el = document.querySelector(`[data-tutorial="${paso.ancla}"]`);
      if (!visible(el)) {
        setCaja(null);
        // Si existe pero está oculto (p. ej. en el móvil) se salta enseguida; si no existe, se espera a que cargue su sección.
        if (performance.now() - inicio > (el ? 150 : ESPERA_MS)) {
          if (direccion.current === -1 && i === 0) direccion.current = 1;
          if (direccion.current === 1 && ultimo) { cerrar(true); return; }
          ir(direccion.current);
          return;
        }
        cuadro = requestAnimationFrame(seguir);
        return;
      }
      const r = el.getBoundingClientRect();
      if (!centrado) {
        centrado = true;
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      setCaja((prev) => (prev && prev.x === r.left && prev.y === r.top && prev.w === r.width && prev.h === r.height
        ? prev : { x: r.left, y: r.top, w: r.width, h: r.height }));
      cuadro = requestAnimationFrame(seguir);
    };
    cuadro = requestAnimationFrame(seguir);
    return () => cancelAnimationFrame(cuadro);
  }, [abierto, i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ubica la burbuja con su tamaño real.
  useLayoutEffect(() => {
    if (!caja || !burbuja.current) { setPos(null); return; }
    const b = { w: burbuja.current.offsetWidth, h: burbuja.current.offsetHeight };
    const nueva = ubicarBurbuja(caja, b, paso.lado, window.innerWidth, window.innerHeight);
    setPos((prev) => (prev && prev.lado === nueva.lado && prev.left === nueva.left && prev.top === nueva.top && prev.flecha === nueva.flecha ? prev : nueva));
  }, [caja, i]); // eslint-disable-line react-hooks/exhaustive-deps

  // El foco va al botón principal en cada paso, sin mover la página.
  useEffect(() => {
    if (abierto && pos) principal.current?.focus({ preventScroll: true });
  }, [abierto, i, !!pos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teclado: flechas para moverse, Esc para salir. Se captura antes que los atajos de la app.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cerrar(false); }
      else if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); ir(1); }
      else if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); ir(-1); }
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => window.removeEventListener('keydown', alTeclear, true);
  }, [abierto, cerrar, ir]);

  if (!abierto || !paso) return null;

  const foco = caja && {
    left: caja.x - HOLGURA, top: caja.y - HOLGURA, width: caja.w + HOLGURA * 2, height: caja.h + HOLGURA * 2,
  };

  return (
    <div className="tutorial" role="presentation">
      {/* Capa que bloquea la app mientras dura el recorrido; el foco la oscurece con su sombra. */}
      <div className="tutorial-capa" onClick={(e) => e.stopPropagation()} />
      {foco && <div className="tutorial-foco" style={foco} aria-hidden />}

      <div
        ref={burbuja} key={i}
        className={`tutorial-burbuja lado-${pos?.lado ?? 'abajo'} ${pos ? 'lista' : ''}`}
        style={pos ? { left: pos.left, top: pos.top, '--flecha': `${pos.flecha}px` } as React.CSSProperties : { left: -9999, top: 0 }}
        role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo" aria-describedby="tutorial-texto"
      >
        <span className="tutorial-flecha" aria-hidden />
        <div className="tutorial-cab">
          <span className="tutorial-icono" aria-hidden><Icono nombre={paso.icono} tamano={18} /></span>
          <span className="tutorial-contador">{t('Paso {n} de {total}', { n: i + 1, total: PASOS_TUTORIAL.length })}</span>
          <button className="tutorial-saltar" onClick={() => cerrar(false)}>{t('Saltar')}</button>
        </div>
        <h2 id="tutorial-titulo">{t(paso.titulo)}</h2>
        <p id="tutorial-texto">{t(paso.texto)}</p>
        {paso.nota && <p className="tutorial-nota">{t(paso.nota)}</p>}
        <div className="tutorial-pie">
          <ol className="tutorial-puntos" aria-hidden>
            {PASOS_TUTORIAL.map((p, j) => <li key={p.ancla} className={j === i ? 'actual' : j < i ? 'hecho' : ''} />)}
          </ol>
          {i > 0 && <button className="boton boton-fantasma" onClick={() => ir(-1)}>{t('Anterior')}</button>}
          <button ref={principal} className="boton boton-primario" onClick={() => ir(1)}>
            {ultimo ? t('Empezar') : t('Siguiente')} {!ultimo && <Icono nombre="flecha" tamano={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
