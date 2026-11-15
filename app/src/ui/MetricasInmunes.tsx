/**
 * SISTEMA INMUNE EN MÉTRICAS — las defensas no tienen un lugar en la figura del cuerpo, así que se
 * muestran como mediciones: las señales (temperatura, piel, alergias), los factores que las bajan
 * (sueño, estrés, radiación) y los órganos del sistema como miniaturas.
 * Los umbrales son los mismos que usan las reglas de `core/reglas/inmune.ts` y `util.ts`.
 */
import type { Historial } from '../core/historial';
import { promedio } from '../core/historial';
import { FIEBRE } from '../core/reglas/inmune';
import { INFO_SENSOR, type Hallazgo, type Nivel, type TipoSensor } from '../core/tipos';
import { cajaOrgano, curva, linea, ORGANOS_INMUNES } from './anatomia';
import { InsigniaNivel, NOMBRE_NIVEL } from './componentes/basicos';
import { MiniTendencia } from './componentes/MiniTendencia';
import { useIdioma, useT } from './idioma';

type EstadoVisual = Nivel | 'sinDatos';

const r1 = (v: number) => Math.round(v * 10) / 10;

interface Metrica {
  sensor: TipoSensor;
  nombre: string;
  valor?: number;
  unidad: string;
  nivel: EstadoVisual;
  /** Qué significa el valor o con qué se compara (texto traducible y sus variables). */
  nota: string;
  vars?: Record<string, number>;
}

function nivelTemperatura(t: number): Nivel {
  if (t < FIEBRE.hipotermia || t >= FIEBRE.alta) return 'alerta';
  if (t >= FIEBRE.fiebre) return 'aviso';
  if (t >= FIEBRE.febricula) return 'info';
  return 'normal';
}

const nivelSintoma = (v: number): Nivel => (v >= 6 ? 'alerta' : v >= 3 ? 'aviso' : v > 0 ? 'info' : 'normal');

function metricas(h: Historial | undefined): { senales: Metrica[]; factores: Metrica[] } {
  const ult = (s: TipoSensor) => h?.ultima(s)?.valor;
  const temp = ult('temperatura');
  const piel = ult('sxPiel');
  const alergia = ult('sxAlergia');
  const noches = h?.ultimas('horasSueno', 3).map((l) => l.valor) ?? [];
  const sueno = noches.length ? r1(promedio(noches)) : undefined;
  const estres = ult('estres');
  const dosis = ult('dosisRadiacion');
  const m = (sensor: TipoSensor, valor: number | undefined, nivel: (v: number) => Nivel, nota: string, nombre = INFO_SENSOR[sensor].nombre, vars?: Record<string, number>): Metrica =>
    ({ sensor, nombre, valor: valor === undefined ? undefined : r1(valor), unidad: INFO_SENSOR[sensor].unidad, nivel: valor === undefined ? 'sinDatos' : nivel(valor), nota, vars });
  return {
    senales: [
      m('temperatura', temp, nivelTemperatura, 'Fiebre desde {t} °C', undefined, { t: FIEBRE.fiebre }),
      m('sxPiel', piel, nivelSintoma, 'Herpes labial, erupciones'),
      m('sxAlergia', alergia, nivelSintoma, 'Alergias atípicas'),
    ],
    factores: [
      m('horasSueno', sueno, (v) => (v < 6 ? 'aviso' : 'normal'), 'Promedio de 3 noches · bajo si < 6 h', 'Sueño'),
      m('estres', estres, (v) => (v >= 70 ? 'aviso' : 'normal'), 'Alto desde 70/100', 'Estrés'),
      m('dosisRadiacion', dosis, (v) => (v >= 300 ? 'aviso' : 'normal'), 'Afecta las defensas desde 300 mSv', 'Radiación acumulada'),
    ],
  };
}

function Tarjeta({ m }: { m: Metrica }) {
  const { t, idioma } = useIdioma();
  return (
    <li className={`metrica nivel-borde-${m.nivel}`}>
      <span className="metrica-nombre">{t(m.nombre)}</span>
      <span className="metrica-valor">
        {m.valor === undefined ? '—' : m.valor.toLocaleString(idioma)}
        {m.valor !== undefined && <small>{m.unidad}</small>}
      </span>
      <span className="metrica-nota"><span className={`punto nivel-${m.nivel}`} aria-hidden /> {t(m.valor === undefined ? 'Sin datos' : NOMBRE_NIVEL[m.nivel])} · {t(m.nota, m.vars)}</span>
    </li>
  );
}

interface Props {
  nivel: EstadoVisual;
  historial?: Historial;
  hallazgos: Hallazgo[];
  seleccionado: boolean;
  onSeleccionar: () => void;
}

export function MetricasInmunes({ nivel, historial, hallazgos, seleccionado, onSeleccionar }: Props) {
  const t = useT();
  const { senales, factores } = metricas(historial);
  const conAviso = hallazgos.filter((h) => h.nivel !== 'normal');

  return (
    <div className="metricas-inmunes" aria-label={t('Sistema inmune: métricas')}>
      <button className={`metricas-cab ${seleccionado ? 'seleccionado' : ''}`} aria-pressed={seleccionado} onClick={onSeleccionar}>
        <span>
          <strong>{t('Defensas')}</strong>
          <small>{conAviso.length ? conAviso.map((h) => t(h.titulo)).join(' · ') : t('Sin hallazgos activos del sistema inmune')}</small>
        </span>
        <InsigniaNivel nivel={nivel} />
      </button>

      <h3 className="metricas-titulo">{t('Señales')}</h3>
      <ul className="metricas-grilla">{senales.map((m) => <Tarjeta key={m.sensor} m={m} />)}</ul>
      {historial && <MiniTendencia sensor="temperatura" historial={historial} base={37} dias={14} />}

      <h3 className="metricas-titulo">{t('Factores que bajan las defensas')}</h3>
      <ul className="metricas-grilla">{factores.map((m) => <Tarjeta key={m.sensor} m={m} />)}</ul>

      <h3 className="metricas-titulo">{t('Órganos del sistema')}</h3>
      <ul className="organos-inmunes">
        {ORGANOS_INMUNES.map((org) => (
          <li key={org.id} title={t(org.funcion)}>
            <svg viewBox={cajaOrgano(org).join(' ')} className={`organo-mini sistema-svg nivel-${nivel}`} aria-hidden>
              {org.formas.map((f, i) => <path key={`f${i}`} className="organo-forma" d={curva(f)} />)}
              {org.trazos?.map((t, i) => <path key={`t${i}`} className="organo-trazo" d={linea(t)} />)}
            </svg>
            <strong>{t(org.nombre)}</strong>
            <small>{t(org.funcion)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
