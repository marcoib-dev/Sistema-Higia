/**
 * FIGURA ANATÓMICA 2D — vista frontal detallada, en SVG.
 * Estilo de maniquí anatómico: silueta idealizada y suave (sin orejas ni rasgos faciales marcados),
 * iluminación difusa y bordes suaves, para que resulte cómoda a la vista y no caiga en el "valle inquietante".
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

/**
 * Contorno del lado derecho del cuerpo (izquierda del espectador es el espejo), de la coronilla a la entrepierna.
 * Proporciones de canon clásico (~7,5 cabezas): cabeza ovalada sin orejas salientes, cuello y hombros
 * con transición suave, manos en "mitón" (los dedos se sugieren con relieve, no con el contorno).
 */
const LADO_DERECHO: Punto[] = [
  [150, 34], [164, 37], [174, 46], [179, 60], [179.5, 74],                  // cráneo
  [178.5, 87], [175, 99], [169, 108], [161, 114],                           // mejilla, mandíbula y mentón
  [162.5, 121], [164, 128],                                                   // cuello
  [172, 135], [185, 140], [199, 144], [210, 150],                           // trapecio
  [218, 160], [222, 175], [224, 198],                                       // hombro y deltoides
  [226, 228], [229, 258], [233, 288], [236, 316], [238, 337],               // brazo y antebrazo (exterior)
  [241, 352], [243, 370], [242, 387], [238, 400], [232, 407],               // mano (exterior) y yemas
  [226, 405], [222, 395], [221, 380], [222, 364], [225, 350], [227, 339],   // mano (interior)
  [224, 316], [220, 290], [215, 262], [211, 235], [208, 212], [203, 194],   // brazo (interior) y axila
  [203, 212], [202, 236], [197, 262], [194, 280],                           // tórax y cintura
  [197, 300], [203, 322], [205, 342],                                       // cresta ilíaca y cadera
  [204, 368], [200, 400], [195, 432], [190, 460], [188, 476],               // muslo y rodilla
  [189, 492], [193, 514], [191, 542], [184, 570], [179, 588],               // pantorrilla y tobillo
  [181.5, 598], [186, 606], [189.5, 613], [187, 619.5], [176, 622], [163, 622], [156.5, 618], [156, 607], [157.5, 597],   // pie
  [160, 586], [161, 562], [163, 528], [162, 498], [163, 474],               // pierna (interior)
  [162, 452], [160, 420], [157, 388], [153, 362], [150, 355],               // muslo (interior) y entrepierna
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

/** Círculo y su espejo. */
const parCirculo = (cx: number, cy: number, r: number, props: Record<string, unknown> = {}) => (
  <>
    <circle cx={cx} cy={cy} r={r} {...props} />
    <circle cx={300 - cx} cy={cy} r={r} {...props} />
  </>
);

// ── Regiones de piel (se tiñen con el estado de su sistema) ───────────

const ZONA_BRAZOS = 'M196 136 L300 136 L300 430 L222 430 L206 200 L200 188 Z';
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
          {/* Volumen lateral: el centro del cuerpo un poco más claro que los bordes */}
          <linearGradient id="grad-piel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--piel-borde)" />
            <stop offset="0.5" stopColor="var(--piel-centro)" />
            <stop offset="1" stopColor="var(--piel-borde)" />
          </linearGradient>
          {/* Luz difusa desde arriba a la izquierda */}
          <radialGradient id="grad-luz" cx="0.4" cy="0.22" r="0.75">
            <stop offset="0" stopColor="#c9d6ff" stopOpacity="0.13" />
            <stop offset="0.6" stopColor="#c9d6ff" stopOpacity="0.03" />
            <stop offset="1" stopColor="#c9d6ff" stopOpacity="0" />
          </radialGradient>
          <filter id="difuminar" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="grad-sombra">
            <stop offset="0" stopColor="#000" stopOpacity="0.45" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sombra en el suelo: ancla la figura y evita que "flote" */}
        <ellipse cx={150} cy={624} rx={62} ry={7} fill="url(#grad-sombra)" aria-hidden />

        {/* Halo fino = todo el cuerpo (radiación) */}
        <Sistema s="cuerpo" clase="aura">
          <path d={SILUETA} fill="none" strokeWidth={5} />
        </Sistema>

        {/* Piel con volumen: gradiente lateral + luz difusa + sombra interior suave en los bordes */}
        <path d={SILUETA} fill="url(#grad-piel)" />
        <g clipPath="url(#clip-cuerpo)" aria-hidden className="sombreado">
          <path d={SILUETA} className="borde-interior" filter="url(#difuminar)" />
          <rect x={0} y={14} width={300} height={626} fill="url(#grad-luz)" />
        </g>
        <g clipPath="url(#clip-cuerpo)">
          {/* Las zonas se difuminan para que no haya cortes rectos entre regiones */}
          <Sistema s="inmune" clase="zona"><path d={ZONA_TORSO} filter="url(#difuminar)" /></Sistema>
          <Sistema s="musculos" clase="zona">
            <path d={ZONA_BRAZOS} filter="url(#difuminar)" />
            <path d={ZONA_BRAZOS} transform="translate(300 0) scale(-1 1)" filter="url(#difuminar)" />
          </Sistema>
          <Sistema s="piernas" clase="zona"><path d={ZONA_PIERNAS} filter="url(#difuminar)" /></Sistema>
        </g>

        {/* Relieve de la superficie (no interactivo) */}
        <g className="relieve" aria-hidden>
          {par('M141 116 C143 124 145 131 147 137')}                         {/* esternocleidomastoideo */}
          {par('M146 140 C138 138 128 139 120 142')}                         {/* clavícula (piel) */}
          {par('M178 299 C172 318 162 334 154 344')}                         {/* pliegue inguinal */}
          {par('M170 486 C174 492 181 491 185 485')}                         {/* rodilla */}
          {par('M163 592 C166 587 172 587 175 592')}                         {/* tobillo */}
          {par('M224 362 C227 369 229 375 228 382')}                         {/* pulgar */}
          {par('M229 389 C229 395 229 400 229.5 405')}                       {/* dedos */}
          {par('M234.5 388 C235.5 394 235.5 399 235 404')}
          <ellipse cx={150} cy={283} rx={1.6} ry={2.2} />                    {/* ombligo */}
        </g>

        {/* Esqueleto (detrás de los órganos) */}
        <Sistema s="huesos" clase="hueso">
          {/* columna: vértebras cervicales pequeñas → lumbares más anchas */}
          {Array.from({ length: 22 }, (_, i) => {
            const w = 5 + i * 0.22;
            return <rect key={i} x={150 - w / 2} y={126 + i * 9.2} width={w} height={6.2} rx={2.2} />;
          })}
          <path d="M120 305 C110 318 114 338 131 345 C140 347 146 340 150 334 C154 340 160 347 169 345 C186 338 190 318 180 305 C167 314 133 314 120 305Z" className="hueso-relleno" />
          {par('M146 140 C132 135 116 139 101 146', { className: 'hueso-trazo' })}
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const y = 164 + k * 12;
            return <g key={k}>{par(`M146 ${y} C134 ${y - 3} 122 ${y + 2} ${113 + k} ${y + 12}`, { className: 'hueso-trazo costilla' })}</g>;
          })}
          {/* fémur y tibia: líneas tenues, sin rótulas circulares */}
          {par('M131 330 C124 335 120 345 121 362 C121 400 121 438 124 468', { className: 'hueso-trazo largo' })}
          {par('M125 490 C125 522 127 556 130 583', { className: 'hueso-trazo largo' })}
        </Sistema>

        {/* Arterias */}
        <Sistema s="corazon" clase="vaso">
          <path d="M150 202 C152 192 160 192 158 204 L154 236 L153 300 C152 316 150 324 150 330" />
          {par('M150 330 C142 338 134 350 132 378 C131 420 130 450 129 470 C128 510 128 540 129 572')}
          {par('M148 198 C134 184 112 178 98 186 C92 206 88 234 86 262 C83 290 78 318 74 342')}
        </Sistema>

        {/* Órganos */}
        <Sistema s="cerebro" clase="organo">
          <path d="M125.5 63 C122 47 136 39 150 39 C164 39 178 47 174.5 63 C172 70 162 73 150 72 C138 73 128 70 125.5 63Z" />
          <path className="detalle" d="M150 41 L150 71 M130 56 C135 51 140 57 146 52 M154 52 C159 47 165 54 170 50 M129 64 C136 61 141 66 147 62 M153 62 C160 59 165 65 171 61 M136 46 C139 49 144 46 146 48 M156 46 C159 43 164 48 167 45" />
        </Sistema>
        {/* Ojos: almendras tenues del color del estado, sin pupila ni esclerótica (no "miran") */}
        <Sistema s="ojos" clase="organo ojos">
          {parCirculo(138, 82, 8, { className: 'area-clic' })}
          {par('M132 82.5 Q138 78.8 144 82.5 Q138 85.6 132 82.5Z')}
          {par('M132.5 81.6 Q138 78.2 143.5 81.6', { className: 'parpado' })}
        </Sistema>
        <Sistema s="oidoInterno" clase="organo">
          {parCirculo(172, 89, 6, { className: 'area-clic' })}
          {par('M172 86.5 c2.5 0 3.2 2.5 1.8 4.2 c-1.3 1.8 -3.6 1.3 -3.6 -0.6 c0 -1.3 1.3 -1.8 1.8 -1.3')}
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
        {/* Sistema inmune: bazo y grupos de ganglios (puntos rellenos, sin anillos) */}
        <Sistema s="inmune" clase="organo">
          <path d="M187 232 c5 2 7 10 4 17 c-3 4 -7 2 -7 -3 c0 -6 1 -11 3 -14Z" />
          {parCirculo(141, 121, 2.1, { className: 'ganglio' })}
          {parCirculo(143.5, 127, 1.7, { className: 'ganglio' })}
          {parCirculo(196, 199, 2.1, { className: 'ganglio' })}
          {parCirculo(199, 206, 1.7, { className: 'ganglio' })}
          {parCirculo(187, 349, 2.3, { className: 'ganglio' })}
          {parCirculo(182, 356, 1.8, { className: 'ganglio' })}
        </Sistema>
        <Sistema s="intestino" clase="organo">
          {/* colon (marco) e intestino delgado (asas) */}
          <path className="trazo grueso" d="M128 326 L126 287 C126 281 130 278 136 278 L164 278 C170 278 174 281 174 287 L174 326" />
          <path d="M134 288 C146 283 156 283 166 288 C169 300 168 313 162 320 C152 324 142 324 136 320 C131 311 131 298 134 288Z" />
          <path className="detalle" d="M139 292 C144 288 149 294 154 290 C159 287 164 292 161 296 C157 300 151 295 146 298 C141 301 137 297 136 302 C135 307 141 307 146 305 C151 303 156 308 161 305 C165 303 166 309 162 312 C157 316 151 311 146 314 C142 316 139 314 138 312" />
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
