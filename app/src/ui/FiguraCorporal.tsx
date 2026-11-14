/**
 * FIGURA ANATÓMICA 2D — vista frontal detallada, en SVG.
 * Silueta generada con curvas suaves a partir de puntos (lado derecho espejado), órganos dibujados a mano.
 * Cada sistema es un grupo seleccionable con clic o teclado; el color muestra el peor nivel de sus riesgos.
 * Coordenadas en un lienzo de 300 × 640 con el eje del cuerpo en x = 150.
 */
import { createContext, useContext, type KeyboardEvent, type ReactNode } from 'react';
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

// ── Silueta ────────────────────────────────────────────────────────────

type Punto = [number, number];

/** Contorno del lado derecho del cuerpo (izquierda del espectador es el espejo), de la coronilla a la entrepierna. */
const LADO_DERECHO: Punto[] = [
  [150, 34], [163, 36], [173, 43], [179, 55], [181, 68],                    // cráneo
  [183, 70], [186, 76], [185, 85], [181, 91],                               // oreja
  [179, 97], [175, 105], [167, 111], [160, 115],                            // mandíbula y mentón
  [163, 121], [164, 130],                                                   // cuello
  [175, 139], [191, 144], [205, 148], [214, 154],                           // trapecio y hombro
  [221, 166], [225, 183], [226, 205], [228, 232], [230, 260],               // deltoides y brazo (exterior)
  [235, 287], [238, 315], [241, 344],                                       // antebrazo (exterior) y muñeca
  [245, 361], [247, 379], [245, 397], [240, 411], [234, 413],               // mano y dedos
  [229, 402], [226, 386], [223, 371], [226, 357], [228, 346],               // dedos (interior) y pulgar
  [222, 318], [217, 293], [212, 262], [208, 233], [206, 207], [199, 185],   // brazo (interior) y axila
  [203, 206], [202, 232], [195, 262], [192, 281], [196, 301],               // tórax, cintura y cresta ilíaca
  [203, 324], [204, 341],                                                   // cadera
  [202, 366], [199, 400], [194, 434], [188, 462], [187, 478],               // muslo y rodilla
  [189, 494], [192, 516], [189, 546], [182, 572], [178, 589],               // pantorrilla y tobillo
  [181, 602], [184, 613], [177, 620], [160, 621], [156, 614], [157, 600],   // pie
  [160, 588], [161, 560], [163, 525], [162, 495], [163, 470],               // pierna (interior)
  [161, 454], [160, 420], [157, 385], [153, 358], [150, 350],               // muslo (interior) y entrepierna
];

const espejo = ([x, y]: Punto): Punto => [300 - x, y];

/** Curva Catmull-Rom cerrada convertida a Bézier cúbicas: contorno suave que pasa por todos los puntos. */
function curvaCerrada(p: Punto[]): string {
  const n = p.length;
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1: Punto = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Punto = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${p2[0]} ${p2[1]}`;
  }
  return `${d}Z`;
}

const SILUETA = curvaCerrada([...LADO_DERECHO, ...LADO_DERECHO.slice(1, -1).reverse().map(espejo)]);

/** Dibuja un trazo y su espejo (para órganos y huesos pares). */
const par = (d: string, props: Record<string, unknown> = {}) => (
  <>
    <path d={d} {...props} />
    <path d={d} transform="translate(300 0) scale(-1 1)" {...props} />
  </>
);

// ── Regiones de piel (se tiñen con el estado de su sistema) ───────────

const ZONA_BRAZOS = 'M194 136 L300 136 L300 430 L222 430 L206 200 L198 184 Z';
const ZONA_PIERNAS = 'M92 342 L208 342 L208 640 L92 640 Z';
const ZONA_TORSO = 'M96 126 L204 126 L204 342 L96 342 Z';

// ── Componente ─────────────────────────────────────────────────────────

interface Props {
  estado: EstadoCorporal;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (sistemas: SistemaCorporal[]) => void;
}

interface ValorFigura extends Props {}
const ContextoFigura = createContext<ValorFigura | null>(null);

/** Grupo seleccionable de un sistema: accesible por teclado, con descripción emergente. */
function Sistema({ s, children, clase = '' }: { s: SistemaCorporal; children: ReactNode; clase?: string }) {
  const { estado, seleccion, onSeleccionar } = useContext(ContextoFigura)!;
  const n = peorEstado(estado, [s]);
  const elegido = !!seleccion?.includes(s);
  const elegir = () => onSeleccionar([s]);
  const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } };
  return (
    <g
      className={`sistema-svg nivel-${n} ${clase} ${elegido ? 'seleccionado' : ''}`}
      role="button" tabIndex={0} aria-label={`${NOMBRE_SISTEMA[s]}: ${NOMBRE_NIVEL[n]}`}
      aria-pressed={elegido} onClick={elegir} onKeyDown={alTeclear}
    >
      <title>{`${NOMBRE_SISTEMA[s]}: ${NOMBRE_NIVEL[n]}`}</title>
      {children}
    </g>
  );
}

export function FiguraCorporal({ estado, seleccion, onSeleccionar }: Props) {
  return (
    <ContextoFigura.Provider value={{ estado, seleccion, onSeleccionar }}>
    <div className="figura">
      <svg viewBox="0 14 300 626" className="figura-svg" aria-label="Figura anatómica con el estado de salud por sistema">
        <defs>
          <clipPath id="clip-cuerpo"><path d={SILUETA} /></clipPath>
          <linearGradient id="grad-piel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--piel-borde)" />
            <stop offset="0.5" stopColor="var(--piel-centro)" />
            <stop offset="1" stopColor="var(--piel-borde)" />
          </linearGradient>
        </defs>

        {/* Halo fino = todo el cuerpo (radiación) */}
        <Sistema s="cuerpo" clase="aura">
          <path d={SILUETA} fill="none" strokeWidth={5} />
        </Sistema>

        {/* Piel */}
        <path d={SILUETA} fill="url(#grad-piel)" />
        <g clipPath="url(#clip-cuerpo)">
          <Sistema s="inmune" clase="zona"><path d={ZONA_TORSO} /></Sistema>
          <Sistema s="musculos" clase="zona"><path d={ZONA_BRAZOS} /><path d={ZONA_BRAZOS} transform="translate(300 0) scale(-1 1)" /></Sistema>
          <Sistema s="piernas" clase="zona"><path d={ZONA_PIERNAS} /></Sistema>
        </g>

        {/* Relieve de la superficie (no interactivo) */}
        <g className="relieve" aria-hidden>
          {par('M140 117 C142 125 145 132 148 139')}
          {par('M178 299 C172 318 162 334 154 344')}
          {par('M168 483 C172 489 180 489 184 482')}
          {par('M163 590 C166 585 172 585 175 590')}
          <ellipse cx={150} cy={283} rx={1.6} ry={2.2} />
        </g>

        {/* Esqueleto (detrás de los órganos) */}
        <Sistema s="huesos" clase="hueso">
          {Array.from({ length: 22 }, (_, i) => <rect key={i} x={146.5} y={126 + i * 9.2} width={7} height={6.2} rx={2} />)}
          <path d="M120 305 C110 318 114 338 131 345 C140 347 146 340 150 334 C154 340 160 347 169 345 C186 338 190 318 180 305 C167 314 133 314 120 305Z" className="hueso-relleno" />
          {par('M146 140 C132 135 116 139 100 146', { className: 'hueso-trazo' })}
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const y = 164 + k * 12;
            return <g key={k}>{par(`M146 ${y} C134 ${y - 3} 122 ${y + 2} ${113 + k} ${y + 12}`, { className: 'hueso-trazo costilla' })}</g>;
          })}
          {par('M117 468 a7 8 0 1 0 14 0 a7 8 0 1 0 -14 0', { className: 'hueso-relleno' })}
        </Sistema>

        {/* Arterias */}
        <Sistema s="corazon" clase="vaso">
          <path d="M152 236 L152 300 C152 318 150 325 150 330" />
          {par('M150 330 C140 340 128 352 124 380 L124 470 L125 560')}
          {par('M146 202 C130 188 104 178 88 186 C84 210 82 240 80 262 C76 290 72 320 67 345')}
        </Sistema>

        {/* Órganos */}
        <Sistema s="cerebro" clase="organo">
          <path d="M125 64 C122 48 136 40 150 40 C164 40 178 48 175 64 C172 71 162 74 150 73 C138 74 128 71 125 64Z" />
          <path className="detalle" d="M150 42 L150 72 M130 56 C135 51 140 57 146 52 M154 52 C159 47 165 54 170 50 M129 64 C136 61 141 66 147 62 M153 62 C160 59 165 65 171 61 M136 46 C139 49 144 46 146 48 M156 46 C159 43 164 48 167 45" />
        </Sistema>
        <Sistema s="ojos" clase="organo ojos">
          {par('M131 85 Q137 81.5 143 85 Q137 88 131 85Z')}
          <circle cx={137} cy={85} r={1.6} className="pupila" /><circle cx={163} cy={85} r={1.6} className="pupila" />
        </Sistema>
        <Sistema s="oidoInterno" clase="organo">
          {par('M178 76 c3.5 0 4.5 3.5 2.6 6 c-1.8 2.6 -5.2 1.8 -5.2 -0.8 c0 -1.8 1.8 -2.6 2.6 -1.8')}
        </Sistema>
        <Sistema s="pulmones" clase="organo">
          <path className="trazo" d="M150 120 L150 152 M150 152 C146 156 143 160 142 166 M150 152 C154 156 157 160 158 166" />
          <path d="M145 158 C133 153 120 164 116 186 C112 208 112 230 117 242 C126 246 138 242 146 237 C148 216 148 184 145 158Z" />
          <path d="M155 158 C167 153 180 164 184 186 C188 208 188 230 183 242 C175 246 165 242 159 237 C161 229 167 221 163 213 C157 207 155 197 155 158Z" />
          <path className="detalle" d="M118 206 C126 202 136 198 145 190 M118 224 C128 222 138 220 146 216 M184 212 C176 208 168 204 158 200" />
        </Sistema>
        <Sistema s="corazon" clase="organo latido">
          <path d="M147 206 C150 197 162 195 170 201 C178 208 177 222 170 231 C164 238 156 240 150 236 C146 230 144 216 147 206Z" />
          <path className="trazo fino" d="M153 200 C151 186 163 180 169 188 M160 198 C160 190 155 187 151 190" />
        </Sistema>
        <Sistema s="metabolismo" clase="organo">
          <path d="M112 246 C124 238 152 239 166 246 C162 256 148 264 130 268 C119 268 110 260 112 246Z" />
          <path d="M162 248 C175 242 189 249 185 263 C181 276 169 280 159 274 C155 268 161 263 167 261 C171 257 165 253 162 248Z" />
        </Sistema>
        <Sistema s="inmune" clase="organo">
          <path d="M187 232 c5 2 7 10 4 17 c-3 4 -7 2 -7 -3 c0 -6 1 -11 3 -14Z" />
          {par('M138 122 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0')}
          {par('M192 200 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0')}
          {par('M168 340 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0')}
        </Sistema>
        <Sistema s="intestino" clase="organo">
          <path className="trazo grueso" d="M124 282 C121 306 124 324 135 328 L165 328 C176 324 179 306 176 282" />
          <path d="M132 286 C144 280 158 280 168 286 C172 299 170 313 164 319 C152 323 140 323 134 317 C130 307 128 295 132 286Z" />
          <path className="detalle" d="M138 292 C146 288 156 290 162 294 C156 300 144 298 138 304 C146 308 156 306 162 310 C154 316 144 314 140 312" />
        </Sistema>

        {/* Músculos (relieve) */}
        <Sistema s="musculos" clase="musculo">
          {par('M152 214 C168 222 186 214 197 192')}
          {par('M218 196 C224 212 224 234 219 250')}
          {par('M178 368 C184 400 183 432 176 456')}
          <path d="M150 250 L150 318 M141 258 L159 258 M141 274 L159 274 M142 292 L158 292" />
        </Sistema>

        {/* Piernas (relieve) */}
        <Sistema s="piernas" clase="musculo">
          {par('M186 500 C190 520 188 540 182 556')}
        </Sistema>

        {/* Contorno */}
        <path d={SILUETA} className="contorno" />
      </svg>

      <p className="ayuda">Pasa el mouse o usa Tab para ver cada sistema · clic o Enter para ver su detalle</p>
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className={`punto nivel-${n}`} />{NOMBRE_NIVEL[n]}</li>
        ))}
      </ul>
    </div>
    </ContextoFigura.Provider>
  );
}
