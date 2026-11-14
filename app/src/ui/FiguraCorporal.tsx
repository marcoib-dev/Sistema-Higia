/**
 * FIGURA ANATÓMICA 2D — ilustraciones del cuerpo (frente y espalda; órganos, músculos y esqueleto).
 * Las imágenes se muestran sin su fondo (un filtro SVG convierte la luminancia en transparencia) y
 * sobre ellas se dibujan las zonas de cada sistema, teñidas con el peor nivel de sus riesgos. El tinte
 * se recorta con la propia figura (máscara), así que solo colorea el cuerpo y respeta el dibujo.
 *
 * Las zonas se definen una vez por vista (sobre la imagen de órganos) y se trasladan a cada ilustración
 * con sus puntos de referencia (mentón, hombros, entrepierna, rodillas y brazos), porque cada dibujo
 * tiene proporciones algo distintas. Lienzo común: 400 × 900, eje del cuerpo en x = 200.
 */
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { NOMBRE_SISTEMA, ORDEN_NIVEL, type EstadoCorporal, type Nivel, type SistemaCorporal } from '../core/tipos';
import { NOMBRE_NIVEL } from './componentes/basicos';

type EstadoVisual = Nivel | 'sinDatos';

export function peorEstado(estado: EstadoCorporal, sistemas: SistemaCorporal[]): EstadoVisual {
  let peor: EstadoVisual = 'sinDatos';
  for (const s of sistemas) {
    const e = estado[s];
    if (e === 'sinDatos') continue;
    if (peor === 'sinDatos' || ORDEN_NIVEL[e] > ORDEN_NIVEL[peor]) peor = e;
  }
  return peor;
}

// ── Ilustraciones ──────────────────────────────────────────────────────

type Vista = 'frente' | 'espalda';
type Capa = 'organos' | 'musculos' | 'esqueleto';

const ANCHO = 400;
const ALTO = 900;
const EJE = ANCHO / 2;

interface Ilustracion {
  /** Tamaño original y caja de la figura dentro de la imagen (px). */
  W: number;
  H: number;
  caja: [number, number, number, number];
  /** Puntos de referencia en el lienzo común: coronilla, mentón, hombros, entrepierna, rodillas, pies. */
  y: [number, number, number, number, number, number];
  /** Medio ancho de hombros. */
  hombro: number;
  /** Brazo izquierdo del espectador: hombro, codo, muñeca y punta de la mano (x, y). */
  brazo: [number, number, number, number, number, number, number, number];
}

const ILUSTRACIONES: Record<Vista, Record<Capa, Ilustracion>> = {
  frente: {
    organos: { W: 1408, H: 768, caja: [589, 37, 818, 734], y: [19, 133, 201, 495, 644, 879], hombro: 102, brazo: [98, 212, 78, 369, 72, 495, 83, 534] },
    musculos: { W: 1024, H: 572, caja: [428, 25, 595, 538], y: [19, 141, 196, 499, 620, 878], hombro: 109, brazo: [94, 212, 72, 369, 69, 455, 78, 526] },
    esqueleto: { W: 1408, H: 768, caja: [585, 29, 822, 742], y: [19, 141, 196, 471, 644, 878], hombro: 94, brazo: [106, 204, 83, 353, 72, 455, 83, 534] },
  },
  espalda: {
    organos: { W: 1024, H: 572, caja: [426, 25, 597, 549], y: [19, 149, 201, 495, 652, 878], hombro: 109, brazo: [95, 212, 72, 377, 72, 487, 83, 534] },
    musculos: { W: 1600, H: 871, caja: [634, 37, 1001, 844], y: [19, 149, 188, 502, 667, 878], hombro: 117, brazo: [91, 204, 59, 345, 44, 455, 28, 518] },
    esqueleto: { W: 1280, H: 720, caja: [520, 11, 760, 689], y: [19, 126, 149, 416, 597, 878], hombro: 94, brazo: [106, 173, 83, 298, 67, 408, 67, 479] },
  },
};

/** Relativa al documento (la app navega con #), así funciona igual en desarrollo y en un build publicado en otra ruta. */
const ruta = (v: Vista, c: Capa) => `cuerpo/${v}-${c}.jpg`;

/** Ubica la imagen para que la figura ocupe el lienzo (de y = 20 a y = 880), centrada en el eje. */
function ubicacion(il: Ilustracion) {
  const [x0, y0, x1, y1] = il.caja;
  const s = 860 / (y1 - y0);
  return { x: EJE - ((x0 + x1) / 2) * s, y: 20 - y0 * s, width: il.W * s, height: il.H * s };
}

// ── Zonas de cada sistema (en las coordenadas de la imagen de órganos de cada vista) ──

type Zona =
  | { tipo: 'elipse'; cx: number; cy: number; rx: number; ry: number }
  | { tipo: 'poligono'; puntos: [number, number][] }
  | { tipo: 'brazos' };

const elipse = (cx: number, cy: number, rx: number, ry: number): Zona => ({ tipo: 'elipse', cx, cy, rx, ry });
const parElipses = (cx: number, cy: number, rx: number, ry: number): Zona[] => [elipse(cx, cy, rx, ry), elipse(2 * EJE - cx, cy, rx, ry)];
const PIERNA: [number, number][] = [[126, 480], [134, 600], [142, 660], [140, 760], [150, 860], [184, 860], [190, 760], [192, 660], [198, 600], [200, 505]];
const espejoPuntos = (p: [number, number][]): [number, number][] => p.map(([x, y]) => [2 * EJE - x, y]);
const piernas: Zona[] = [{ tipo: 'poligono', puntos: PIERNA }, { tipo: 'poligono', puntos: espejoPuntos(PIERNA) }];

/** Orden de dibujo: lo de atrás primero; lo que se dibuja después tiene prioridad al hacer clic. */
const ZONAS: Record<Vista, [SistemaCorporal, Zona[]][]> = {
  frente: [
    ['piernas', piernas],
    ['musculos', [{ tipo: 'brazos' }]],
    ['intestino', [elipse(200, 408, 58, 48)]],
    ['metabolismo', [elipse(200, 333, 60, 30)]],
    ['pulmones', [elipse(166, 242, 31, 54), elipse(236, 242, 33, 54)]],
    ['corazon', [elipse(212, 252, 22, 26)]],
    ['huesos', [...parElipses(152, 466, 24, 18), ...parElipses(166, 646, 15, 17)]],
    ['inmune', [...parElipses(184, 150, 7, 7), ...parElipses(120, 218, 9, 9), ...parElipses(174, 480, 8, 8)]],
    ['cerebro', [elipse(200, 58, 40, 36)]],
    ['oidoInterno', parElipses(157, 86, 7, 11)],
    ['ojos', parElipses(183, 92, 10, 6)],
  ],
  espalda: [
    ['piernas', piernas],
    ['musculos', [{ tipo: 'brazos' }]],
    ['intestino', [elipse(200, 428, 58, 40)]],
    ['pulmones', [elipse(167, 240, 30, 52), elipse(233, 240, 30, 52)]],
    ['metabolismo', parElipses(168, 337, 13, 18)],
    ['huesos', [{ tipo: 'poligono', puntos: [[194, 165], [206, 165], [207, 300], [206, 445], [194, 445], [193, 300]] }, ...parElipses(160, 462, 24, 18), ...parElipses(166, 650, 15, 17)]],
    ['inmune', parElipses(185, 152, 7, 7)],
    ['cerebro', [elipse(200, 58, 40, 36)]],
    ['oidoInterno', parElipses(156, 86, 7, 11)],
  ],
};

/** Traslada un punto de la vista base a una ilustración, por tramos entre sus puntos de referencia. */
function trasladar(base: Ilustracion, il: Ilustracion, x: number, y: number): [number, number] {
  const a = base.y, b = il.y;
  let i = 0;
  while (i < a.length - 2 && y > a[i + 1]) i++;
  const t = (y - a[i]) / (a[i + 1] - a[i]);
  const ny = b[i] + t * (b[i + 1] - b[i]);
  // La cabeza conserva su ancho; del cuello para abajo se ajusta al ancho de hombros.
  const k = y < base.y[1] ? 1 : il.hombro / base.hombro;
  return [EJE + (x - EJE) * k, ny];
}

function formas(z: Zona, base: Ilustracion, il: Ilustracion, clave: string): ReactNode {
  if (z.tipo === 'brazos') {
    const [hx, hy, cx, cy, mx, my, px, py] = il.brazo;
    const d = `M${hx} ${hy} L${cx} ${cy} L${mx} ${my} L${px} ${py}`;
    return (
      <g key={clave} className="zona-brazos">
        <path d={d} />
        <path d={d} transform={`translate(${2 * EJE} 0) scale(-1 1)`} />
      </g>
    );
  }
  if (z.tipo === 'elipse') {
    const [cx, cy] = trasladar(base, il, z.cx, z.cy);
    const [, arriba] = trasladar(base, il, z.cx, z.cy - z.ry);
    const [, abajo] = trasladar(base, il, z.cx, z.cy + z.ry);
    const k = z.cy < base.y[1] ? 1 : il.hombro / base.hombro;
    return <ellipse key={clave} cx={cx} cy={cy} rx={z.rx * k} ry={(abajo - arriba) / 2} />;
  }
  return <polygon key={clave} points={z.puntos.map(([x, y]) => trasladar(base, il, x, y).join(',')).join(' ')} />;
}

// ── Componente ─────────────────────────────────────────────────────────

interface Props {
  estado: EstadoCorporal;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (sistemas: SistemaCorporal[]) => void;
}

const CLAVE_VISTA = 'higia.figura';
const leerPreferencia = (): { vista: Vista; capa: Capa } => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTA) ?? '{}') as { vista?: Vista; capa?: Capa };
    return { vista: v.vista === 'espalda' ? 'espalda' : 'frente', capa: v.capa === 'musculos' || v.capa === 'esqueleto' ? v.capa : 'organos' };
  } catch { return { vista: 'frente', capa: 'organos' }; }
};

const VISTAS: [Vista, string][] = [['frente', 'Frente'], ['espalda', 'Espalda']];
const CAPAS: [Capa, string][] = [['organos', 'Órganos'], ['musculos', 'Músculos'], ['esqueleto', 'Esqueleto']];

export function FiguraCorporal({ estado, seleccion, onSeleccionar }: Props) {
  const [{ vista, capa }, setPreferencia] = useState(leerPreferencia);
  const id = useId().replace(/:/g, '');
  const il = ILUSTRACIONES[vista][capa];
  const base = ILUSTRACIONES[vista].organos;
  const pos = ubicacion(il);

  const cambiar = (p: Partial<{ vista: Vista; capa: Capa }>) => setPreferencia((prev) => {
    const nuevo = { ...prev, ...p };
    try { localStorage.setItem(CLAVE_VISTA, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
    return nuevo;
  });

  // Precarga las seis ilustraciones para que cambiar de vista o capa sea instantáneo.
  useEffect(() => {
    for (const v of ['frente', 'espalda'] as Vista[]) for (const c of ['organos', 'musculos', 'esqueleto'] as Capa[]) new Image().src = ruta(v, c);
  }, []);

  // Si piden un sistema que no se ve desde esta vista (p. ej. los ojos de espaldas), se gira la figura.
  useEffect(() => {
    const s = seleccion?.[0];
    if (!s || s === 'cuerpo') return;
    const enVista = (v: Vista) => ZONAS[v].some(([x]) => x === s);
    if (!enVista(vista)) cambiar({ vista: vista === 'frente' ? 'espalda' : 'frente' });
  }, [seleccion]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = (s: SistemaCorporal) => onSeleccionar([s]);
  const alTeclear = (s: SistemaCorporal) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(s); } };
  const clases = (s: SistemaCorporal) => `sistema-svg nivel-${peorEstado(estado, [s])} ${seleccion?.includes(s) ? 'seleccionado' : ''}`;
  const etiqueta = (s: SistemaCorporal) => `${NOMBRE_SISTEMA[s]}: ${NOMBRE_NIVEL[peorEstado(estado, [s])]}`;

  const imagen = (filtro: string) => (
    <image href={ruta(vista, capa)} {...pos} preserveAspectRatio="none" filter={`url(#${filtro})`} />
  );

  return (
    <div className="figura">
      <div className="figura-controles">
        <div className="figura-selector" role="group" aria-label="Vista">
          {VISTAS.map(([v, n]) => <button key={v} aria-pressed={vista === v} onClick={() => cambiar({ vista: v })}>{n}</button>)}
        </div>
        <div className="figura-selector" role="group" aria-label="Capa">
          {CAPAS.map(([c, n]) => <button key={c} aria-pressed={capa === c} onClick={() => cambiar({ capa: c })}>{n}</button>)}
        </div>
      </div>

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="figura-svg" aria-label={`Figura anatómica (${vista}, ${CAPAS.find(([c]) => c === capa)![1].toLowerCase()}) con el estado de salud por sistema`}>
        <defs>
          {/* Luminancia → transparencia: quita el fondo oscuro y deja la figura en un blanco azulado del tema. */}
          <filter id={`${id}-figura`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0.87  0 0 0 0 0.91  0 0 0 0 1  0.404 1.359 0.137 0 -0.57" />
            {/* Curva sobre la transparencia: borra los grises tenues del piso sin afectar la figura. */}
            <feComponentTransfer><feFuncA type="gamma" amplitude={1} exponent={2.2} offset={0} /></feComponentTransfer>
          </filter>
          <mask id={`${id}-mascara`} maskUnits="userSpaceOnUse" x={0} y={0} width={ANCHO} height={ALTO}>
            {imagen(`${id}-figura`)}
          </mask>
        </defs>

        {/* Todo el cuerpo (radiación): el halo de la figura toma su color. */}
        <g
          className={`${clases('cuerpo')} aura-cuerpo`} role="button" tabIndex={0} aria-label={etiqueta('cuerpo')}
          aria-pressed={!!seleccion?.includes('cuerpo')} onClick={() => elegir('cuerpo')} onKeyDown={alTeclear('cuerpo')}
        >
          <title>{etiqueta('cuerpo')}</title>
          {imagen(`${id}-figura`)}
        </g>

        {/* Tinte por sistema, recortado con la figura. */}
        <g mask={`url(#${id}-mascara)`} className="tintes" aria-hidden>
          {ZONAS[vista].map(([s, zonas]) => (
            <g key={s} className={`tinte ${clases(s)}`}>{zonas.map((z, i) => formas(z, base, il, `${s}${i}`))}</g>
          ))}
        </g>

        {/* Zonas interactivas (invisibles salvo el contorno al seleccionar). */}
        <g className="zonas">
          {ZONAS[vista].map(([s, zonas]) => (
            <g
              key={s} className={`zona-sistema ${clases(s)}`} role="button" tabIndex={0} aria-label={etiqueta(s)}
              aria-pressed={!!seleccion?.includes(s)} onClick={() => elegir(s)} onKeyDown={alTeclear(s)}
            >
              <title>{etiqueta(s)}</title>
              {zonas.map((z, i) => formas(z, base, il, `${s}${i}`))}
            </g>
          ))}
        </g>
      </svg>

      <p className="ayuda">Pasa el mouse o usa Tab para ver cada sistema · clic o Enter para ver su detalle</p>
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className={`punto nivel-${n}`} />{NOMBRE_NIVEL[n]}</li>
        ))}
      </ul>
    </div>
  );
}
