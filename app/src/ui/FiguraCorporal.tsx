/**
 * FIGURA ANATÓMICA 2D — ilustraciones del cuerpo por categoría (órganos, músculos, huesos) y vista
 * (frente, espalda). En cada categoría solo aparece lo que se pidió: su ilustración y sus zonas.
 *
 * Las imágenes se muestran sin su fondo (un filtro SVG convierte la luminancia en transparencia) y
 * sobre ellas se dibujan las zonas anatómicas (cráneo, costillas, pectorales, hígado…). Cada zona se
 * tiñe con el peor nivel entre su sistema (p. ej. huesos) y su región del cuerpo (p. ej. un golpe en el
 * cráneo). El tinte se recorta con la propia figura, así que solo colorea el cuerpo y respeta el dibujo.
 * Lienzo común: 400 × 900, eje del cuerpo en x = 200. Las coordenadas de cada zona son las de su ilustración.
 */
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import {
  NOMBRE_SISTEMA, ORDEN_NIVEL, type EstadoCorporal, type Nivel, type RegionCuerpo, type SistemaCorporal,
} from '../core/tipos';
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

const peor = (a: EstadoVisual, b: EstadoVisual | undefined): EstadoVisual =>
  !b || b === 'sinDatos' ? a : a === 'sinDatos' || ORDEN_NIVEL[b] > ORDEN_NIVEL[a] ? b : a;

// ── Ilustraciones ──────────────────────────────────────────────────────

type Vista = 'frente' | 'espalda';
export type Categoria = 'organos' | 'musculos' | 'huesos';

const ANCHO = 400;
const ALTO = 900;
const EJE = ANCHO / 2;

/** Archivo de cada categoría (public/cuerpo/<vista>-<archivo>.jpg). */
const ARCHIVO: Record<Categoria, string> = { organos: 'organos', musculos: 'musculos', huesos: 'esqueleto' };

/** Tamaño original y caja de la figura dentro de cada imagen (px). */
const ILUSTRACIONES: Record<Vista, Record<Categoria, { W: number; H: number; caja: [number, number, number, number] }>> = {
  frente: {
    organos: { W: 1408, H: 768, caja: [589, 37, 818, 734] },
    musculos: { W: 1024, H: 572, caja: [428, 25, 595, 538] },
    huesos: { W: 1408, H: 768, caja: [585, 29, 822, 742] },
  },
  espalda: {
    organos: { W: 1024, H: 572, caja: [426, 25, 597, 549] },
    musculos: { W: 1600, H: 871, caja: [634, 37, 1001, 844] },
    huesos: { W: 1280, H: 720, caja: [520, 11, 760, 689] },
  },
};

/** Relativa al documento (la app navega con #), así funciona igual en desarrollo y en un build publicado en otra ruta. */
const ruta = (v: Vista, c: Categoria) => `cuerpo/${v}-${ARCHIVO[c]}.jpg`;

/** Ubica la imagen para que la figura ocupe el lienzo (de y = 20 a y = 880), centrada en el eje. */
function ubicacion(v: Vista, c: Categoria) {
  const il = ILUSTRACIONES[v][c];
  const [x0, y0, x1, y1] = il.caja;
  const s = 860 / (y1 - y0);
  return { x: EJE - ((x0 + x1) / 2) * s, y: 20 - y0 * s, width: il.W * s, height: il.H * s };
}

// ── Zonas anatómicas ───────────────────────────────────────────────────

type Forma = { cx: number; cy: number; rx: number; ry: number; rot?: number } | { puntos: [number, number][] };

interface ZonaFigura {
  id: string;
  nombre: string;
  /** Sistema de salud cuyo estado tiñe la zona (y que se selecciona al hacer clic). */
  sistema: SistemaCorporal;
  /** Región del cuerpo: un hallazgo localizado (p. ej. golpe en el cráneo) también la tiñe. */
  region?: RegionCuerpo;
  formas: Forma[];
}

const e = (cx: number, cy: number, rx: number, ry: number, rot = 0): Forma => ({ cx, cy, rx, ry, rot });
/** Elipse y su espejo (para estructuras pares). El ángulo se refleja. */
const par = (cx: number, cy: number, rx: number, ry: number, rot = 0): Forma[] => [e(cx, cy, rx, ry, rot), e(2 * EJE - cx, cy, rx, ry, -rot)];
const z = (id: string, nombre: string, sistema: SistemaCorporal, region: RegionCuerpo | undefined, ...formas: (Forma | Forma[])[]): ZonaFigura =>
  ({ id, nombre, sistema, region, formas: formas.flat() });

/** Orden de dibujo: lo de atrás primero; lo que se dibuja después tiene prioridad al hacer clic. */
const ZONAS: Record<Vista, Record<Categoria, ZonaFigura[]>> = {
  frente: {
    organos: [
      z('intestino', 'Intestinos', 'intestino', 'abdomen', e(200, 408, 58, 48)),
      z('higado', 'Hígado', 'metabolismo', 'abdomen', e(172, 322, 34, 20)),
      z('estomago', 'Estómago', 'intestino', 'abdomen', e(232, 322, 22, 18)),
      z('pulmones', 'Pulmones', 'pulmones', 'torax', e(166, 242, 31, 54), e(236, 242, 33, 54)),
      z('corazon', 'Corazón', 'corazon', 'torax', e(212, 252, 22, 26)),
      z('traquea', 'Tráquea', 'pulmones', 'cuello', e(200, 182, 6, 18)),
      z('ganglios', 'Ganglios linfáticos', 'inmune', undefined, par(184, 150, 7, 7), par(120, 218, 9, 9), par(174, 480, 8, 8)),
      z('cerebro', 'Cerebro', 'cerebro', 'craneo', e(200, 58, 40, 36)),
      z('oido', 'Oído interno', 'oidoInterno', 'craneo', par(157, 86, 7, 11)),
      z('ojos', 'Ojos', 'ojos', 'cara', par(183, 92, 10, 6)),
    ],
    musculos: [
      z('cuello-m', 'Cuello', 'musculos', 'cuello', e(200, 160, 20, 18)),
      z('pectorales', 'Pectorales', 'musculos', 'torax', par(164, 232, 34, 28)),
      z('abdominales', 'Abdominales', 'musculos', 'abdomen', e(200, 342, 36, 60)),
      z('biceps', 'Brazos (bíceps)', 'musculos', 'brazos', par(85, 298, 17, 58, 8)),
      z('antebrazos-m', 'Antebrazos', 'musculos', 'brazos', par(72, 408, 14, 50, 6)),
      z('deltoides', 'Hombros (deltoides)', 'musculos', 'brazos', par(103, 214, 17, 22)),
      z('cuadriceps', 'Muslos (cuádriceps)', 'piernas', 'piernas', par(155, 553, 30, 84)),
      z('piernas-m', 'Piernas (tibial y gemelos)', 'piernas', 'piernas', par(145, 725, 22, 78)),
    ],
    huesos: [
      z('costillas', 'Costillas', 'huesos', 'torax', e(200, 272, 70, 66)),
      z('esternon', 'Esternón', 'huesos', 'torax', e(200, 255, 8, 42)),
      z('claviculas', 'Clavículas', 'huesos', 'torax', par(172, 197, 26, 6)),
      z('cervical', 'Columna cervical', 'huesos', 'cuello', e(200, 165, 6, 14)),
      z('lumbar', 'Columna lumbar', 'huesos', 'columna', e(200, 366, 8, 34)),
      z('pelvis', 'Pelvis', 'huesos', 'pelvis', e(200, 430, 70, 42)),
      z('humeros', 'Húmeros', 'huesos', 'brazos', par(94, 278, 8, 72, 9)),
      z('antebrazos-h', 'Radio y cúbito', 'huesos', 'brazos', par(78, 404, 9, 50, 6)),
      z('manos', 'Manos', 'huesos', 'brazos', par(78, 494, 12, 38)),
      z('femures', 'Fémures', 'huesos', 'piernas', par(154, 545, 11, 85)),
      z('rodillas', 'Rodillas', 'huesos', 'piernas', par(150, 644, 12, 14)),
      z('tibias', 'Tibias y peronés', 'huesos', 'piernas', par(150, 741, 11, 82)),
      z('pies', 'Pies', 'huesos', 'piernas', par(137, 850, 38, 28)),
      z('craneo', 'Cráneo', 'huesos', 'craneo', e(200, 55, 33, 32)),
    ],
  },
  espalda: {
    organos: [
      z('intestino', 'Intestinos', 'intestino', 'abdomen', e(200, 428, 58, 40)),
      z('pulmones', 'Pulmones', 'pulmones', 'torax', e(167, 240, 30, 52), e(233, 240, 30, 52)),
      z('rinones', 'Riñones', 'metabolismo', 'abdomen', par(168, 337, 13, 18)),
      z('traquea', 'Tráquea', 'pulmones', 'cuello', e(200, 175, 6, 16)),
      z('ganglios', 'Ganglios linfáticos', 'inmune', undefined, par(185, 152, 7, 7)),
      z('cerebro', 'Cerebro', 'cerebro', 'craneo', e(200, 58, 40, 36)),
      z('oido', 'Oído interno', 'oidoInterno', 'craneo', par(156, 86, 7, 11)),
    ],
    musculos: [
      z('trapecio', 'Trapecio', 'musculos', 'cuello', e(200, 200, 50, 62)),
      z('dorsales', 'Dorsales', 'musculos', 'torax', par(155, 330, 26, 45)),
      z('triceps', 'Brazos (tríceps)', 'musculos', 'brazos', par(92, 282, 15, 58, 10)),
      z('antebrazos-m', 'Antebrazos', 'musculos', 'brazos', par(64, 400, 13, 52, 10)),
      z('deltoides', 'Hombros (deltoides)', 'musculos', 'brazos', par(98, 212, 17, 22)),
      z('gluteos', 'Glúteos', 'piernas', 'pelvis', par(167, 455, 30, 32)),
      z('isquiotibiales', 'Muslos (isquiotibiales)', 'piernas', 'piernas', par(156, 568, 30, 68)),
      z('gemelos', 'Gemelos', 'piernas', 'piernas', par(152, 700, 22, 62)),
    ],
    huesos: [
      z('costillas', 'Costillas', 'huesos', 'torax', e(200, 240, 68, 64)),
      z('escapulas', 'Escápulas', 'huesos', 'torax', par(153, 181, 22, 26)),
      z('columna', 'Columna vertebral', 'huesos', 'columna', { puntos: [[193, 105], [207, 105], [207, 405], [193, 405]] }),
      z('pelvis', 'Pelvis y sacro', 'huesos', 'pelvis', e(200, 372, 72, 38)),
      z('humeros', 'Húmeros', 'huesos', 'brazos', par(95, 235, 8, 60, 10)),
      z('antebrazos-h', 'Radio y cúbito', 'huesos', 'brazos', par(75, 353, 9, 55, 8)),
      z('manos', 'Manos', 'huesos', 'brazos', par(67, 443, 12, 35)),
      z('femures', 'Fémures', 'huesos', 'piernas', par(153, 502, 10, 65)),
      z('rodillas', 'Rodillas', 'huesos', 'piernas', par(153, 597, 11, 13)),
      z('tibias', 'Tibias y peronés', 'huesos', 'piernas', par(153, 722, 10, 60)),
      z('pies', 'Pies', 'huesos', 'piernas', par(145, 856, 18, 14)),
      z('craneo', 'Cráneo', 'huesos', 'craneo', e(200, 63, 33, 38)),
    ],
  },
};

const VISTAS: [Vista, string][] = [['frente', 'Frente'], ['espalda', 'Espalda']];
export const CATEGORIAS: [Categoria, string][] = [['organos', 'Órganos'], ['musculos', 'Músculos'], ['huesos', 'Huesos']];

/** Dónde mostrar un sistema: primero la vista y categoría actuales, luego las demás. */
function ubicarSistema(s: SistemaCorporal, vista: Vista, categoria: Categoria): { vista: Vista; categoria: Categoria } | null {
  const vistas: Vista[] = [vista, vista === 'frente' ? 'espalda' : 'frente'];
  const categorias: Categoria[] = [categoria, ...(['organos', 'musculos', 'huesos'] as Categoria[]).filter((c) => c !== categoria)];
  for (const c of categorias) for (const v of vistas) if (ZONAS[v][c].some((zona) => zona.sistema === s)) return { vista: v, categoria: c };
  return null;
}

// ── Componente ─────────────────────────────────────────────────────────

interface Props {
  estado: EstadoCorporal;
  /** Peor nivel por región del cuerpo (hallazgos localizados, p. ej. golpe en el cráneo). */
  regiones?: Partial<Record<RegionCuerpo, Nivel>>;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (sistemas: SistemaCorporal[]) => void;
}

const CLAVE_VISTA = 'higia.figura';
const leerPreferencia = (): { vista: Vista; categoria: Categoria } => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTA) ?? '{}') as { vista?: Vista; categoria?: Categoria };
    return { vista: v.vista === 'espalda' ? 'espalda' : 'frente', categoria: v.categoria === 'musculos' || v.categoria === 'huesos' ? v.categoria : 'organos' };
  } catch { return { vista: 'frente', categoria: 'organos' }; }
};

export function FiguraCorporal({ estado, regiones = {}, seleccion, onSeleccionar }: Props) {
  const [{ vista, categoria }, setPreferencia] = useState(leerPreferencia);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const id = useId().replace(/:/g, '');
  const pos = ubicacion(vista, categoria);
  const zonas = ZONAS[vista][categoria];

  const cambiar = (p: Partial<{ vista: Vista; categoria: Categoria }>) => setPreferencia((prev) => {
    const nuevo = { ...prev, ...p };
    try { localStorage.setItem(CLAVE_VISTA, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
    return nuevo;
  });

  // Precarga las seis ilustraciones para que cambiar de vista o categoría sea instantáneo.
  useEffect(() => {
    for (const v of ['frente', 'espalda'] as Vista[]) for (const c of ['organos', 'musculos', 'huesos'] as Categoria[]) new Image().src = ruta(v, c);
  }, []);

  // Si piden un sistema que no aparece en lo que se ve (p. ej. los huesos con la categoría Órganos), se cambia a donde está.
  useEffect(() => {
    const s = seleccion?.[0];
    if (!s || s === 'cuerpo' || zonas.some((zona) => zona.sistema === s)) return;
    const destino = ubicarSistema(s, vista, categoria);
    if (destino) cambiar(destino);
  }, [seleccion]); // eslint-disable-line react-hooks/exhaustive-deps

  const nivelZona = (zona: ZonaFigura): EstadoVisual => peor(peorEstado(estado, [zona.sistema]), zona.region ? regiones[zona.region] : undefined);
  const etiqueta = (zona: ZonaFigura) => `${zona.nombre} · ${NOMBRE_SISTEMA[zona.sistema]}: ${NOMBRE_NIVEL[nivelZona(zona)]}`;
  // Si se tocó una zona, se resalta solo esa; si el sistema se eligió desde la lista, todas sus zonas.
  const activa = zonas.find((x) => x.id === zonaActiva && seleccion?.includes(x.sistema));
  const elegida = (zona: ZonaFigura) => (activa ? zona.id === activa.id : !!seleccion?.includes(zona.sistema));
  const elegir = (zona: ZonaFigura) => { setZonaActiva(zona.id); onSeleccionar([zona.sistema]); };
  const alTeclear = (f: () => void) => (ev: KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); f(); } };

  const nivelCuerpo = peorEstado(estado, ['cuerpo']);

  const formas = (zona: ZonaFigura) => zona.formas.map((f, i) => ('puntos' in f
    ? <polygon key={i} points={f.puntos.map((p) => p.join(',')).join(' ')} />
    : <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} transform={f.rot ? `rotate(${f.rot} ${f.cx} ${f.cy})` : undefined} />));

  const imagen = (filtro: string) => <image href={ruta(vista, categoria)} {...pos} preserveAspectRatio="none" filter={`url(#${filtro})`} />;

  return (
    <div className="figura">
      <div className="figura-controles">
        <div className="figura-selector" role="group" aria-label="Qué mostrar">
          {CATEGORIAS.map(([c, n]) => <button key={c} aria-pressed={categoria === c} onClick={() => cambiar({ categoria: c })}>{n}</button>)}
        </div>
        <div className="figura-selector" role="group" aria-label="Vista">
          {VISTAS.map(([v, n]) => <button key={v} aria-pressed={vista === v} onClick={() => cambiar({ vista: v })}>{n}</button>)}
        </div>
      </div>

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="figura-svg" aria-label={`Figura anatómica: ${CATEGORIAS.find(([c]) => c === categoria)![1].toLowerCase()}, vista de ${vista}`}>
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
          className={`sistema-svg nivel-${nivelCuerpo} aura-cuerpo ${seleccion?.includes('cuerpo') ? 'seleccionado' : ''}`}
          role="button" tabIndex={0} aria-label={`Todo el cuerpo (radiación): ${NOMBRE_NIVEL[nivelCuerpo]}`}
          aria-pressed={!!seleccion?.includes('cuerpo')} onClick={() => { setZonaActiva(null); onSeleccionar(['cuerpo']); }}
          onKeyDown={alTeclear(() => { setZonaActiva(null); onSeleccionar(['cuerpo']); })}
        >
          <title>{`Todo el cuerpo (radiación): ${NOMBRE_NIVEL[nivelCuerpo]}`}</title>
          {imagen(`${id}-figura`)}
        </g>

        {/* Tinte por zona, recortado con la figura. */}
        <g mask={`url(#${id}-mascara)`} className="tintes" aria-hidden>
          {zonas.map((zona) => (
            <g key={zona.id} className={`tinte sistema-svg nivel-${nivelZona(zona)} ${elegida(zona) ? 'seleccionado' : ''}`}>{formas(zona)}</g>
          ))}
        </g>

        {/* Zonas interactivas (invisibles salvo el contorno al pasar o seleccionar). */}
        <g className="zonas">
          {zonas.map((zona) => (
            <g
              key={zona.id} className={`zona-sistema sistema-svg nivel-${nivelZona(zona)} ${elegida(zona) ? 'seleccionado' : ''}`}
              role="button" tabIndex={0} aria-label={etiqueta(zona)} aria-pressed={elegida(zona)}
              onClick={() => elegir(zona)} onKeyDown={alTeclear(() => elegir(zona))}
            >
              <title>{etiqueta(zona)}</title>
              {formas(zona)}
            </g>
          ))}
        </g>
      </svg>

      <p className="figura-zona" aria-live="polite">
        {activa ? <><strong>{activa.nombre}</strong> · {NOMBRE_SISTEMA[activa.sistema]}: {NOMBRE_NIVEL[nivelZona(activa)]}</> : 'Pasa el mouse o usa Tab para ver cada zona · clic o Enter para ver su detalle'}
      </p>
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className={`punto nivel-${n}`} />{NOMBRE_NIVEL[n]}</li>
        ))}
      </ul>
    </div>
  );
}
