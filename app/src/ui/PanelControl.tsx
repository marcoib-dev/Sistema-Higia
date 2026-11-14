import { ESCENARIOS, type Escenario } from '../adaptadores/simulador/escenarios';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { NOMBRE_DESTINO, RETARDO_TIERRA, type Actividad, type Contexto, type Destino, type Perfil, type Ubicacion } from '../core/tipos';

export function PanelEscenarios({ onEscenario, onOcultar }: { onEscenario: (e: Escenario) => void; onOcultar: () => void }) {
  return (
    <section className="tarjeta">
      <div className="tarjeta-cab">
        <h2>Simulador de escenarios</h2>
        <button className="enlace" onClick={onOcultar}>Ocultar</button>
      </div>
      <div className="escenarios">
        {ESCENARIOS.map((e) => (
          <button key={e.id} onClick={() => onEscenario(e)} title={e.descripcion}>{e.nombre}</button>
        ))}
      </div>
    </section>
  );
}

interface Props {
  perfil: Perfil;
  contexto: Contexto;
  onPerfil: (id: string) => void;
  onContexto: (c: Partial<Contexto>) => void;
}

const UBICACIONES: { id: Ubicacion; nombre: string }[] = [
  { id: 'habitat', nombre: 'Hábitat' }, { id: 'eva', nombre: 'EVA' }, { id: 'rover', nombre: 'Rover' },
];
const ACTIVIDADES: { id: Actividad; nombre: string }[] = [
  { id: 'reposo', nombre: 'Reposo' }, { id: 'trabajo', nombre: 'Trabajo' }, { id: 'ejercicio', nombre: 'Ejercicio' },
];

type Clave = { [K in keyof Contexto]: Contexto[K] extends boolean ? K : never }[keyof Contexto];
const INTERRUPTORES: { clave: Clave; nombre: string }[] = [
  { clave: 'pantallaHabitat', nombre: 'Pantalla del hábitat' },
  { clave: 'pantallaPersonal', nombre: 'Pantalla personal' },
  { clave: 'auricular', nombre: 'Auricular' },
  { clave: 'companeroCercano', nombre: 'Compañero cercano (radio)' },
  { clave: 'medicoABordo', nombre: 'Médico a bordo' },
  { clave: 'conexionHabitat', nombre: 'Conexión con el hábitat (activa la IA)' },
  { clave: 'conexionTierra', nombre: 'Conexión con Tierra' },
];

export function PanelControl({ perfil, contexto, onPerfil, onContexto }: Props) {
  return (
    <>
      <section className="tarjeta">
        <h2>Astronauta</h2>
        <select value={perfil.id} onChange={(e) => onPerfil(e.target.value)} aria-label="Astronauta">
          {PERFILES.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.rol}</option>)}
        </select>
        <dl className="perfil">
          <dt>Formación médica</dt><dd>{perfil.formacionMedica}</dd>
          <dt>Experiencia</dt><dd>{perfil.experiencia}</dd>
          <dt>Tolerancia al estrés</dt><dd>{perfil.toleranciaEstres}{perfil.propensoPanico ? ' · propenso a pánico' : ''}</dd>
          <dt>Sueño</dt><dd>{perfil.horarioSueno.inicio}:00 – {perfil.horarioSueno.fin}:00</dd>
        </dl>
      </section>

      <section className="tarjeta">
        <h2>Contexto</h2>
        <p className="etiqueta-grupo">Ubicación</p>
        <div className="segmentado" role="group" aria-label="Ubicación">
          {UBICACIONES.map((u) => (
            <button key={u.id} aria-pressed={contexto.ubicacion === u.id} onClick={() => onContexto({ ubicacion: u.id })}>{u.nombre}</button>
          ))}
        </div>
        <p className="etiqueta-grupo">Actividad</p>
        <div className="segmentado" role="group" aria-label="Actividad">
          {ACTIVIDADES.map((a) => (
            <button key={a.id} aria-pressed={contexto.actividad === a.id} onClick={() => onContexto({ actividad: a.id })}>{a.nombre}</button>
          ))}
        </div>
        <label className="fila">
          Destino
          <select value={contexto.destino} onChange={(e) => onContexto({ destino: e.target.value as Destino })}>
            {(Object.keys(NOMBRE_DESTINO) as Destino[]).map((d) => <option key={d} value={d}>{NOMBRE_DESTINO[d]}</option>)}
          </select>
        </label>
        <p className="sub nota">Retardo con Tierra: {RETARDO_TIERRA[contexto.destino]}</p>
        <label className="fila">
          Tormenta solar activa
          <input type="checkbox" checked={contexto.climaEspacial === 'tormentaSolar'}
            onChange={(e) => onContexto({ climaEspacial: e.target.checked ? 'tormentaSolar' : 'calmo' })} />
        </label>
        <label className="fila">
          Hora del hábitat
          <input type="number" min={0} max={23} value={contexto.hora}
            onChange={(e) => onContexto({ hora: Math.min(23, Math.max(0, Number(e.target.value))) })} />
        </label>
        {INTERRUPTORES.map((i) => (
          <label key={i.clave} className="fila">
            {i.nombre}
            <input type="checkbox" checked={contexto[i.clave]} onChange={(e) => onContexto({ [i.clave]: e.target.checked })} />
          </label>
        ))}
      </section>
    </>
  );
}
