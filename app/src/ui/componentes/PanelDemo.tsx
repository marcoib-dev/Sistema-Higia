/**
 * Panel lateral de la demo: lo que en la realidad harían los sensores y el hábitat.
 * Separado de la interfaz del astronauta para no confundir. Tecla D para abrir y cerrar.
 */
import { useEffect, useRef, useState } from 'react';
import { ESCENARIOS, type Escenario } from '../../adaptadores/simulador/escenarios';
import { PERFILES } from '../../adaptadores/simulador/perfiles';
import { NOMBRE_DESTINO, RETARDO_TIERRA, type Actividad, type Contexto, type Destino, type Perfil, type Ubicacion } from '../../core/tipos';
import { Icono } from '../iconos';
import { Interruptor, Segmentado } from './basicos';

type Pestana = 'escenarios' | 'astronauta' | 'contexto';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  perfil: Perfil;
  contexto: Contexto;
  onPerfil: (id: string) => void;
  onContexto: (c: Partial<Contexto>) => void;
  onEscenario: (e: Escenario) => void;
}

const NIVEL_FORMACION: Record<Perfil['formacionMedica'], string> = { ninguna: 'Sin formación médica', basica: 'Formación básica', medico: 'Médica/o' };
const NIVEL_EXPERIENCIA: Record<Perfil['experiencia'], string> = { novato: 'Novato', intermedio: 'Intermedio', veterano: 'Veterano' };
const TOLERANCIA: Record<Perfil['toleranciaEstres'], string> = { baja: 'baja', media: 'media', alta: 'alta' };

export function PanelDemo({ abierto, onCerrar, perfil, contexto: c, onPerfil, onContexto, onEscenario }: Props) {
  const [pestana, setPestana] = useState<Pestana>('escenarios');
  const [ultimo, setUltimo] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  // Cerrado = fuera del orden de tabulación y de los lectores de pantalla (inert).
  useEffect(() => {
    panel.current?.toggleAttribute('inert', !abierto);
    if (abierto) panel.current?.focus();
  }, [abierto]);

  const ejecutar = (e: Escenario) => {
    onEscenario(e);
    setUltimo(e.id);
  };

  return (
    <aside
      id="panel-demo" ref={panel} tabIndex={-1} className={`panel-demo ${abierto ? 'abierto' : ''}`}
      aria-label="Controles de la demo"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }}
    >
      <div className="panel-demo-cab">
        <div>
          <h2>Controles de la demo</h2>
          <p>Simulan lo que harían los sensores y el hábitat.</p>
        </div>
        <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar panel (Esc)"><Icono nombre="cerrar" /></button>
      </div>

      <div className="pestanas" role="tablist" aria-label="Secciones de la demo">
        {([['escenarios', 'Escenarios'], ['astronauta', 'Astronauta'], ['contexto', 'Contexto']] as [Pestana, string][]).map(([id, nombre]) => (
          <button key={id} role="tab" aria-selected={pestana === id} aria-controls={`demo-${id}`} id={`tab-${id}`} onClick={() => setPestana(id)}>
            {nombre}
          </button>
        ))}
      </div>

      <div className="panel-demo-cuerpo">
        {pestana === 'escenarios' && (
          <ul id="demo-escenarios" role="tabpanel" aria-labelledby="tab-escenarios" className="lista-escenarios">
            {ESCENARIOS.map((e) => (
              <li key={e.id}>
                <button onClick={() => ejecutar(e)} className={ultimo === e.id ? 'reciente' : ''}>
                  <span className="escenario-nombre">{e.nombre}</span>
                  <span className="escenario-desc">{e.descripcion}</span>
                  <Icono nombre={ultimo === e.id ? 'check' : 'reproducir'} tamano={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {pestana === 'astronauta' && (
          <div id="demo-astronauta" role="tabpanel" aria-labelledby="tab-astronauta" className="lista-perfiles" >
            {PERFILES.map((p) => (
              <button key={p.id} role="radio" aria-checked={perfil.id === p.id} className="tarjeta-perfil" onClick={() => onPerfil(p.id)}>
                <span className="perfil-avatar" aria-hidden>{p.nombre.split(' ').map((x) => x[0]).join('')}</span>
                <span className="perfil-datos">
                  <strong>{p.nombre}</strong>
                  <span>{p.rol}</span>
                  <small>
                    {NIVEL_FORMACION[p.formacionMedica]} · {NIVEL_EXPERIENCIA[p.experiencia]} · tolerancia al estrés {TOLERANCIA[p.toleranciaEstres]}
                    {p.propensoPanico ? ' · propenso a pánico' : ''}
                  </small>
                </span>
              </button>
            ))}
            <p className="nota">Cambiar de astronauta no altera la detección: solo cómo se le comunica.</p>
          </div>
        )}

        {pestana === 'contexto' && (
          <div id="demo-contexto" role="tabpanel" aria-labelledby="tab-contexto" className="grupos-contexto">
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
              <Interruptor etiqueta="Tormenta solar activa" activo={c.climaEspacial === 'tormentaSolar'}
                onCambio={(v) => onContexto({ climaEspacial: v ? 'tormentaSolar' : 'calmo' })} />
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
        )}
      </div>
    </aside>
  );
}
