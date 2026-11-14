import { ESCENARIOS, type Escenario } from '../adaptadores/simulador/escenarios';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import type { Contexto, Perfil, Ubicacion } from '../core/tipos';

interface Props {
  perfil: Perfil;
  contexto: Contexto;
  vozActiva: boolean;
  onPerfil: (id: string) => void;
  onContexto: (c: Partial<Contexto>) => void;
  onEscenario: (e: Escenario) => void;
  onVoz: (v: boolean) => void;
}

const UBICACIONES: { id: Ubicacion; nombre: string }[] = [
  { id: 'habitat', nombre: 'Hábitat' }, { id: 'eva', nombre: 'EVA' }, { id: 'rover', nombre: 'Rover' },
];

const INTERRUPTORES: { clave: keyof Contexto; nombre: string }[] = [
  { clave: 'pantallaHabitat', nombre: 'Pantalla del hábitat' },
  { clave: 'pantallaPersonal', nombre: 'Pantalla personal' },
  { clave: 'auricular', nombre: 'Auricular' },
  { clave: 'conexionHabitat', nombre: 'Conexión con el hábitat' },
  { clave: 'conexionTierra', nombre: 'Conexión con Tierra' },
];

export function PanelControl({ perfil, contexto, vozActiva, onPerfil, onContexto, onEscenario, onVoz }: Props) {
  return (
    <>
      <section className="tarjeta">
        <h2>Simulador de escenarios</h2>
        <div className="escenarios">
          {ESCENARIOS.map((e) => (
            <button key={e.id} onClick={() => onEscenario(e)} title={e.descripcion}>{e.nombre}</button>
          ))}
        </div>
      </section>

      <section className="tarjeta">
        <h2>Astronauta</h2>
        <select value={perfil.id} onChange={(e) => onPerfil(e.target.value)}>
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
        <div className="segmentado" role="radiogroup" aria-label="Ubicación">
          {UBICACIONES.map((u) => (
            <button key={u.id} aria-pressed={contexto.ubicacion === u.id} onClick={() => onContexto({ ubicacion: u.id })}>{u.nombre}</button>
          ))}
        </div>
        <label className="fila">
          Hora del hábitat
          <input type="number" min={0} max={23} value={contexto.hora}
            onChange={(e) => onContexto({ hora: Math.min(23, Math.max(0, Number(e.target.value))) })} />
        </label>
        {INTERRUPTORES.map((i) => (
          <label key={i.clave} className="fila">
            {i.nombre}
            <input type="checkbox" checked={contexto[i.clave] as boolean} onChange={(e) => onContexto({ [i.clave]: e.target.checked })} />
          </label>
        ))}
        <label className="fila">
          Reproducir voz (auricular)
          <input type="checkbox" checked={vozActiva} onChange={(e) => onVoz(e.target.checked)} />
        </label>
      </section>
    </>
  );
}
