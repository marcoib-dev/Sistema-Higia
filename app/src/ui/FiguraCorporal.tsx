import type { ReactElement } from 'react';
import { NOMBRE_SISTEMA, ORDEN_NIVEL, type EstadoCorporal, type Nivel, type SistemaCorporal } from '../core/tipos';

type EstadoVisual = Nivel | 'sinDatos';

export const COLOR_NIVEL: Record<EstadoVisual, string> = {
  normal: 'var(--ok)', info: 'var(--info)', aviso: 'var(--aviso)', alerta: 'var(--alerta)', sinDatos: 'var(--sin-datos)',
};
export const NOMBRE_NIVEL: Record<EstadoVisual, string> = {
  normal: 'Normal', info: 'Info', aviso: 'Aviso', alerta: 'Alerta', sinDatos: 'Sin datos',
};

interface Region {
  id: string;
  sistemas: SistemaCorporal[];
  forma: (props: { fill: string; stroke: string; strokeWidth: number }) => ReactElement;
}

/** Orden de dibujo: lo de atrás primero. */
const REGIONES: Region[] = [
  { id: 'brazos', sistemas: ['musculos'], forma: (p) => <g {...p}><rect x={30} y={96} width={24} height={150} rx={12} /><rect x={146} y={96} width={24} height={150} rx={12} /></g> },
  { id: 'piernas', sistemas: ['piernas'], forma: (p) => <g {...p}><rect x={66} y={232} width={30} height={170} rx={14} /><rect x={104} y={232} width={30} height={170} rx={14} /></g> },
  { id: 'torso', sistemas: ['inmune'], forma: (p) => <rect x={58} y={90} width={84} height={152} rx={26} {...p} /> },
  { id: 'columna', sistemas: ['huesos'], forma: (p) => <rect x={96} y={98} width={8} height={136} rx={4} {...p} /> },
  { id: 'pulmones', sistemas: ['pulmones'], forma: (p) => <g {...p}><ellipse cx={80} cy={138} rx={13} ry={26} /><ellipse cx={120} cy={138} rx={13} ry={26} /></g> },
  { id: 'corazon', sistemas: ['corazon'], forma: (p) => <circle cx={108} cy={154} r={11} {...p} /> },
  { id: 'abdomen', sistemas: ['metabolismo', 'intestino'], forma: (p) => <ellipse cx={100} cy={208} rx={28} ry={17} {...p} /> },
  { id: 'cabeza', sistemas: ['cerebro'], forma: (p) => <circle cx={100} cy={48} r={32} {...p} /> },
  { id: 'oidos', sistemas: ['oidoInterno'], forma: (p) => <g {...p}><ellipse cx={66} cy={50} rx={5} ry={9} /><ellipse cx={134} cy={50} rx={5} ry={9} /></g> },
  { id: 'ojos', sistemas: ['ojos'], forma: (p) => <g {...p}><circle cx={88} cy={44} r={5} /><circle cx={112} cy={44} r={5} /></g> },
];

export function peorEstado(estado: EstadoCorporal, sistemas: SistemaCorporal[]): EstadoVisual {
  let peor: EstadoVisual = 'sinDatos';
  for (const s of sistemas) {
    const e = estado[s];
    if (e === 'sinDatos') continue;
    if (peor === 'sinDatos' || ORDEN_NIVEL[e] > ORDEN_NIVEL[peor]) peor = e;
  }
  return peor;
}

interface Props {
  estado: EstadoCorporal;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (sistemas: SistemaCorporal[]) => void;
}

export function FiguraCorporal({ estado, seleccion, onSeleccionar }: Props) {
  const halo = estado.cuerpo;
  const seleccionada = (r: SistemaCorporal[]) => seleccion?.join() === r.join();

  return (
    <div className="figura">
      <svg viewBox="0 0 200 420" role="img" aria-label="Estado de salud por sistema corporal">
        {/* Halo = todo el cuerpo (radiación) */}
        <rect
          x={14} y={6} width={172} height={408} rx={44} fill="none"
          stroke={COLOR_NIVEL[halo]} strokeWidth={seleccionada(['cuerpo']) ? 4 : 2.5} strokeDasharray="7 6"
          className="region" onClick={() => onSeleccionar(['cuerpo'])}
        >
          <title>{NOMBRE_SISTEMA.cuerpo}: {NOMBRE_NIVEL[halo]}</title>
        </rect>
        <rect x={90} y={78} width={20} height={16} fill="var(--sin-datos)" />
        {REGIONES.map((r) => {
          const e = peorEstado(estado, r.sistemas);
          const sel = seleccionada(r.sistemas);
          return (
            <g key={r.id} className="region" onClick={() => onSeleccionar(r.sistemas)}>
              <title>{r.sistemas.map((s) => NOMBRE_SISTEMA[s]).join(' / ')}: {NOMBRE_NIVEL[e]}</title>
              {r.forma({ fill: COLOR_NIVEL[e], stroke: sel ? 'var(--texto)' : 'var(--fondo)', strokeWidth: sel ? 3 : 2 })}
            </g>
          );
        })}
      </svg>
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className="punto" style={{ background: COLOR_NIVEL[n] }} />{NOMBRE_NIVEL[n]}</li>
        ))}
      </ul>
    </div>
  );
}
