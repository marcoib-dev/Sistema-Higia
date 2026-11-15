/**
 * TENDENCIA DE UN DATO — los últimos valores con la línea base marcada, para los hallazgos que
 * dependen de semanas (sueño, ánimo, peso, fuerza…). La radiación se muestra como dosis acumulada
 * frente al límite de carrera, con la proyección punteada.
 */
import type { Historial } from '../../core/historial';
import { LIMITE_CARRERA_MSV } from '../../core/reglas/radiacion';
import { INFO_SENSOR, type Lectura, type TipoSensor } from '../../core/tipos';
import { useT } from '../idioma';

/** Datos que tienen sentido como tendencia (el resto es una medición puntual). */
export const DATOS_CON_TENDENCIA: TipoSensor[] = [
  'horasSueno', 'animo', 'pesoCorporal', 'caloriasDia', 'aceptabilidadComida', 'hidratacion', 'fuerza',
  'aptitudAerobica', 'minutosResistencia', 'cargaMicrobiana', 'cohesionEquipo', 'horasTrabajo', 'dosisRadiacion',
];

const DIA = 86_400_000;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Un valor por día (el último de cada día), de los últimos `dias`. */
function porDia(ls: Lectura[], dias: number): Lectura[] {
  const desde = (ls.at(-1)?.timestamp ?? 0) - dias * DIA;
  const m = new Map<string, Lectura>();
  for (const l of ls) if (l.timestamp >= desde) m.set(new Date(l.timestamp).toDateString(), l);
  return [...m.values()];
}

export function MiniTendencia({ sensor, historial, base, dias = 21 }: { sensor: TipoSensor; historial: Historial; base?: number; dias?: number }) {
  const t = useT();
  const serie = porDia(historial.ultimas(sensor, 200), dias);
  if (sensor === 'dosisRadiacion') return <BarraDosis serie={serie} />;
  if (serie.length < 3) return null;
  const info = INFO_SENSOR[sensor];
  const vs = serie.map((l) => l.valor);
  const min = Math.min(...vs, base ?? Infinity);
  const max = Math.max(...vs, base ?? -Infinity);
  const margen = (max - min) * 0.15 || 1;
  const lo = min - margen, hi = max + margen;
  const W = 220, H = 48;
  const x = (i: number) => (serie.length === 1 ? W / 2 : (i / (serie.length - 1)) * (W - 8) + 4);
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo)) * (H - 8);
  const puntos = serie.map((l, i) => `${x(i).toFixed(1)},${y(l.valor).toFixed(1)}`).join(' ');
  const ult = serie.at(-1)!;
  const promedio = r1(vs.reduce((a, b) => a + b, 0) / vs.length);
  const descripcion = `${t(info.nombre)}: ${serie.length} ${t('días')}, ${t('promedio')} ${promedio} ${info.unidad}, ${t('último')} ${r1(ult.valor)} ${info.unidad}${base !== undefined ? `, ${t('línea base')} ${base}` : ''}`;

  return (
    <figure className="mini-tendencia">
      <figcaption>
        <span>{t(info.nombre)} · {serie.length} {t('días')}</span>
        <span className="mini-valores">{t('prom.')} <b>{promedio}</b> · {t('último')} <b>{r1(ult.valor)}</b> {info.unidad}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion} preserveAspectRatio="none">
        {base !== undefined && <line className="mini-base" x1="0" x2={W} y1={y(base)} y2={y(base)} />}
        <polyline className="mini-linea" points={puntos} />
        <circle className="mini-ultimo" cx={x(serie.length - 1)} cy={y(ult.valor)} r="3" />
      </svg>
      {base !== undefined && <span className="mini-leyenda"><i /> {t('línea base')} {base} {info.unidad}</span>}
    </figure>
  );
}

/** Dosis acumulada frente al límite de carrera, con la proyección de los últimos 7 días hasta el final de la serie. */
function BarraDosis({ serie }: { serie: Lectura[] }) {
  const t = useT();
  const ult = serie.at(-1);
  if (!ult) return null;
  const semana = serie.filter((l) => l.timestamp >= ult.timestamp - 7 * DIA);
  const ritmo = semana.length >= 2 ? (ult.valor - semana[0].valor) / Math.max(1, (ult.timestamp - semana[0].timestamp) / DIA) : 0;
  const fraccion = Math.min(1, ult.valor / LIMITE_CARRERA_MSV);
  // Proyección a 90 días con el ritmo actual (solo como referencia visual).
  const proyectada = Math.min(1, (ult.valor + Math.max(0, ritmo) * 90) / LIMITE_CARRERA_MSV);
  return (
    <figure className="barra-dosis">
      <figcaption>
        <span>{t('Dosis acumulada')}</span>
        <span className="mini-valores"><b>{Math.round(ult.valor)}</b> {t('de')} {LIMITE_CARRERA_MSV} mSv · {Math.round(fraccion * 100)} %</span>
      </figcaption>
      <div className="dosis-pista" role="img"
        aria-label={`${Math.round(fraccion * 100)} % ${t('del límite de carrera')}${ritmo > 0 ? `; ${t('a este ritmo, {p} % en 90 días', { p: Math.round(proyectada * 100) })}` : ''}`}>
        <span className="dosis-proyeccion" style={{ width: `${proyectada * 100}%` }} />
        <span className="dosis-actual" style={{ width: `${fraccion * 100}%` }} />
      </div>
      {ritmo > 0 && <span className="mini-leyenda"><i className="punteada" /> {t('en 90 días a {ritmo} mSv/día: {p} %', { ritmo: r1(ritmo), p: Math.round(proyectada * 100) })}</span>}
    </figure>
  );
}
