/** Pestaña Contexto: situación, día de misión, EVA, personas, enlaces y salidas, con la aptitud para tareas. */
import { useState } from 'react';
import type { AptitudTareas } from '../../core/nucleo';
import {
  NOMBRE_DESTINO, NOMBRE_TAREA, RETARDO_TIERRA, TAREAS_CRITICAS,
  type Actividad, type Contexto, type Destino, type Ubicacion,
} from '../../core/tipos';
import { Interruptor, Segmentado } from '../componentes/basicos';
import { Icono } from '../iconos';

interface Props {
  contexto: Contexto;
  aptitud: AptitudTareas;
  /** Minuto de inicio de la EVA en curso (null si no hay). */
  evaDesde: number | null;
  ahora: number;
  onContexto: (c: Partial<Contexto>) => void;
  onIniciarEva: (minutosPrerrespiracion: number) => void;
  onTerminarEva: () => void;
}

const ATAJOS_DIA = [30, 180, 500];

export function PestanaContexto({ contexto: c, aptitud, evaDesde, ahora, onContexto, onIniciarEva, onTerminarEva }: Props) {
  const [prerrespiracion, setPrerrespiracion] = useState(120);
  const [dia, setDia] = useState<number | null>(null);
  const minutosEva = evaDesde ? Math.floor((ahora - evaDesde) / 60_000) : 0;

  return (
    <div className="grupos-contexto">
      <fieldset>
        <legend>Aptitud para tareas críticas</legend>
        <ul className="semaforo-tareas">
          {TAREAS_CRITICAS.map((t) => {
            const { apto, motivos } = aptitud[t];
            return (
              <li key={t} className={apto ? 'apto' : 'no-apto'}>
                <Icono nombre={apto ? 'check' : 'alerta'} tamano={16} />
                <span>
                  <strong>{NOMBRE_TAREA[t]}</strong>
                  <small>{apto ? 'Sin contraindicaciones' : `No recomendada: ${motivos.map((m) => m.titulo).join(' · ')}`}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset>
        <legend>Situación</legend>
        <Segmentado<Ubicacion> etiqueta="Ubicación" valor={c.ubicacion} onCambio={(ubicacion) => onContexto({ ubicacion })}
          opciones={[{ id: 'habitat', nombre: 'Hábitat' }, { id: 'eva', nombre: 'EVA' }, { id: 'rover', nombre: 'Rover' }]} />
        <Segmentado<Actividad> etiqueta="Actividad" valor={c.actividad} onCambio={(actividad) => onContexto({ actividad })}
          opciones={[{ id: 'reposo', nombre: 'Reposo' }, { id: 'trabajo', nombre: 'Trabajo' }, { id: 'ejercicio', nombre: 'Ejercicio' }]} />
        <div className="campo-doble">
          <label className="campo">
            <span className="campo-etiqueta">Destino</span>
            <select value={c.destino} onChange={(e) => onContexto({ destino: e.target.value as Destino })}>
              {(Object.keys(NOMBRE_DESTINO) as Destino[]).map((d) => <option key={d} value={d}>{NOMBRE_DESTINO[d]}</option>)}
            </select>
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Hora del hábitat</span>
            <select value={c.hora} onChange={(e) => onContexto({ hora: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </label>
        </div>
        <div className="campo">
          <span className="campo-etiqueta" id="etq-dia">Día de misión <b className="valor-dia">{dia ?? c.diaMision}</b></span>
          <input type="range" min={1} max={900} step={1} value={dia ?? c.diaMision} aria-labelledby="etq-dia" aria-valuetext={`Día ${dia ?? c.diaMision}`}
            onChange={(e) => setDia(Number(e.target.value))}
            onPointerUp={() => { if (dia !== null) { onContexto({ diaMision: dia }); setDia(null); } }}
            onKeyUp={() => { if (dia !== null) { onContexto({ diaMision: dia }); setDia(null); } }} />
          <div className="atajos-dia">
            {ATAJOS_DIA.map((d) => <button key={d} type="button" className={`chip ${c.diaMision === d ? 'activo' : ''}`} onClick={() => onContexto({ diaMision: d })}>Día {d}</button>)}
          </div>
        </div>
        <Interruptor etiqueta="Transición de gravedad" descripcion="Llegada a la superficie o regreso en las últimas 72 h" activo={c.transicionGravedad}
          onCambio={(v) => onContexto({ transicionGravedad: v })} />
        <Interruptor etiqueta="Tormenta solar activa" activo={c.climaEspacial === 'tormentaSolar'}
          onCambio={(v) => onContexto({ climaEspacial: v ? 'tormentaSolar' : 'calmo' })} />
      </fieldset>

      <fieldset>
        <legend>Caminata espacial</legend>
        {evaDesde ? (
          <div className="bloque-eva en-curso">
            <p><Icono nombre="traje" tamano={16} /> EVA en curso · <b>{minutosEva} min</b></p>
            <button className="boton" onClick={onTerminarEva}>Terminar EVA</button>
          </div>
        ) : (
          <div className="bloque-eva">
            <label className="campo">
              <span className="campo-etiqueta">Prerrespiración de oxígeno (min)</span>
              <input type="number" min={0} max={240} step={5} value={prerrespiracion} onChange={(e) => setPrerrespiracion(Number(e.target.value))} />
            </label>
            <button className="boton boton-primario" onClick={() => onIniciarEva(prerrespiracion)}><Icono nombre="traje" tamano={16} /> Iniciar EVA</button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Personas</legend>
        <Interruptor etiqueta="Compañero cercano" descripcion="Al alcance de la radio de proximidad" activo={c.companeroCercano} onCambio={(v) => onContexto({ companeroCercano: v })} />
        <Interruptor etiqueta="Médico a bordo" descripcion="Si no hay, Higia da guías paso a paso" activo={c.medicoABordo} onCambio={(v) => onContexto({ medicoABordo: v })} />
      </fieldset>

      <fieldset>
        <legend>Enlaces</legend>
        <Interruptor etiqueta="Conexión con el hábitat" descripcion="Activa el envío de reportes y la escalada a la base" activo={c.conexionHabitat} onCambio={(v) => onContexto({ conexionHabitat: v })} />
        <Interruptor etiqueta="Conexión con Tierra" descripcion={`Retardo actual: ${RETARDO_TIERRA[c.destino]}`} activo={c.conexionTierra} onCambio={(v) => onContexto({ conexionTierra: v })} />
      </fieldset>

      <fieldset>
        <legend>Dispositivos de salida</legend>
        <Interruptor etiqueta="Pantalla del hábitat" activo={c.pantallaHabitat} onCambio={(v) => onContexto({ pantallaHabitat: v })} />
        <Interruptor etiqueta="Pantalla personal" activo={c.pantallaPersonal} onCambio={(v) => onContexto({ pantallaPersonal: v })} />
        <Interruptor etiqueta="Auricular" activo={c.auricular} onCambio={(v) => onContexto({ auricular: v })} />
      </fieldset>
    </div>
  );
}
