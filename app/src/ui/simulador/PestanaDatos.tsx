/**
 * Pestaña Datos: inyección manual de cualquier dato del catálogo. Los controles se generan desde
 * INFO_SENSOR (no se escriben a mano) y el dato se envía al soltar el deslizador o confirmar el campo.
 */
import { useState } from 'react';
import { REGLAS } from '../../core/reglas';
import {
  CATEGORIAS_SENSOR, INFO_SENSOR, NOMBRE_CATEGORIA_SENSOR, ORDEN_NIVEL,
  type Hallazgo, type Lectura, type Nivel, type Perfil, type TipoSensor,
} from '../../core/tipos';
import type { Historial } from '../../core/historial';
import { Punto } from '../componentes/basicos';
import { Icono } from '../iconos';
import { useT } from '../idioma';

const SENSORES = Object.keys(INFO_SENSOR) as TipoSensor[];

/** Peor nivel entre los hallazgos de las reglas que leen ese dato. */
function nivelDe(sensor: TipoSensor, hallazgos: Hallazgo[]): Nivel | 'sinDatos' {
  let peor: Nivel | 'sinDatos' = 'sinDatos';
  for (const r of REGLAS) {
    if (!r.sensores.includes(sensor)) continue;
    const h = hallazgos.find((x) => x.riesgoId === r.id);
    if (h && (peor === 'sinDatos' || ORDEN_NIVEL[h.nivel] > ORDEN_NIVEL[peor])) peor = h.nivel;
  }
  return peor;
}

const redondear = (v: number, paso: number) => Math.round(v / paso) * paso;
const mostrar = (v: number, paso: number) => (paso < 1 ? v.toFixed(String(paso).split('.')[1]?.length ?? 1) : String(Math.round(v)));

interface Props {
  perfil: Perfil;
  historial: Historial;
  hallazgos: Hallazgo[];
  onInyectar: (ls: Lectura[]) => void;
  onDiaNormal: () => void;
  onLimpiar: () => void;
}

export function PestanaDatos({ perfil, historial, hallazgos, onInyectar, onDiaNormal, onLimpiar }: Props) {
  const t = useT();
  const enviar = (sensor: TipoSensor, valor: number) => {
    const t = Date.now();
    const l = (s: TipoSensor, v: number): Lectura => ({ sensor: s, valor: v, timestamp: t, fuente: 'manual' });
    // La presión viaja de a pares: sistólica y diastólica en la misma medición.
    if (sensor === 'presionSistolica') onInyectar([l(sensor, valor), l('presionDiastolica', historial.ultima('presionDiastolica')?.valor ?? 76)]);
    else if (sensor === 'presionDiastolica') onInyectar([l('presionSistolica', historial.ultima('presionSistolica')?.valor ?? 118), l(sensor, valor)]);
    else onInyectar([l(sensor, valor)]);
  };

  return (
    <div className="pestana-datos">
      <div className="acciones-datos">
        <button className="boton" onClick={onDiaNormal}><Icono nombre="check" tamano={16} /> {t('Día normal')}</button>
        <button className="boton boton-fantasma" onClick={onLimpiar}><Icono nombre="reiniciar" tamano={16} /> {t('Limpiar todo')}</button>
      </div>
      <p className="nota">{t('Mueve un control y suéltalo: el dato llega a Higia como si lo hubiera medido un sensor. La marca vertical es la línea base de {nombre}.', { nombre: perfil.nombre })}</p>
      {CATEGORIAS_SENSOR.map((c, i) => {
        const lista = SENSORES.filter((s) => INFO_SENSOR[s].categoria === c);
        return (
          <details key={c} className="grupo-datos" open={i === 0}>
            <summary>{t(NOMBRE_CATEGORIA_SENSOR[c])} <span>{lista.length}</span></summary>
            <ul>
              {lista.map((s) => (
                <FilaDato key={s} sensor={s} ultimo={historial.ultima(s)?.valor} base={perfil.lineaBase[s as keyof Perfil['lineaBase']]}
                  nivel={nivelDe(s, hallazgos)} onEnviar={(v) => enviar(s, v)} />
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function FilaDato({ sensor, ultimo, base, nivel, onEnviar }: {
  sensor: TipoSensor; ultimo?: number; base?: number; nivel: Nivel | 'sinDatos'; onEnviar: (v: number) => void;
}) {
  const t = useT();
  const info = INFO_SENSOR[sensor];
  const inicial = ultimo ?? base ?? info.min;
  const [valor, setValor] = useState(inicial);
  const [tocado, setTocado] = useState(false);
  const v = tocado ? valor : inicial;
  const id = `dato-${sensor}`;
  const confirmar = (x: number) => {
    const limpio = Math.min(info.max, Math.max(info.min, redondear(x, info.paso)));
    setValor(limpio);
    setTocado(false);
    onEnviar(limpio);
  };
  const posBase = base !== undefined ? ((base - info.min) / (info.max - info.min)) * 100 : null;

  return (
    <li className="fila-dato">
      <div className="fila-dato-cab">
        <Punto nivel={nivel} />
        <label htmlFor={id}>{t(info.nombre)}</label>
        <span className="fila-dato-ultimo">{ultimo !== undefined ? `${mostrar(ultimo, info.paso)} ${info.unidad}` : t('sin datos')}</span>
      </div>
      <div className="fila-dato-control">
        <div className="deslizador" style={posBase !== null ? { '--base': `${posBase}%` } as React.CSSProperties : undefined}>
          <input
            id={id} type="range" min={info.min} max={info.max} step={info.paso} value={v}
            aria-valuetext={`${mostrar(v, info.paso)} ${info.unidad}`}
            onChange={(e) => { setValor(Number(e.target.value)); setTocado(true); }}
            onPointerUp={(e) => confirmar(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key.startsWith('Page')) confirmar(Number((e.target as HTMLInputElement).value)); }}
          />
          {posBase !== null && <span className="deslizador-base" aria-hidden title={t('Línea base: {v} {u}', { v: base ?? 0, u: info.unidad })} />}
        </div>
        <input
          type="number" className="campo-numero" min={info.min} max={info.max} step={info.paso} value={mostrar(v, info.paso)}
          aria-label={`${t(info.nombre)} (${info.unidad})`}
          onChange={(e) => { setValor(Number(e.target.value)); setTocado(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmar(Number((e.target as HTMLInputElement).value)); }}
          onBlur={(e) => { if (tocado) confirmar(Number(e.target.value)); }}
        />
        <span className="fila-dato-unidad">{info.unidad}</span>
      </div>
    </li>
  );
}
