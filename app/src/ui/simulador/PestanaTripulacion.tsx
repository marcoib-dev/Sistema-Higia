/** Pestaña Tripulación: astronauta activo (con antecedentes y líneas base) y cómo responde el resto. */
import { PERFILES } from '../../adaptadores/simulador/perfiles';
import { INFO_SENSOR, type Perfil, type TipoSensor } from '../../core/tipos';
import { Interruptor, Segmentado } from '../componentes/basicos';
import type { Simulador } from './useSimulador';

const NIVEL_FORMACION: Record<Perfil['formacionMedica'], string> = { ninguna: 'Sin formación médica', basica: 'Formación básica', medico: 'Médica/o' };
const NIVEL_EXPERIENCIA: Record<Perfil['experiencia'], string> = { novato: 'Novato', intermedio: 'Intermedio', veterano: 'Veterano' };
const DEMORAS = [{ id: '0', nombre: 'Al instante' }, { id: '5000', nombre: '+5 s' }, { id: '15000', nombre: '+15 s' }];
/** Líneas base que se muestran (las más útiles para entender los escenarios). */
const BASES: TipoSensor[] = ['frecuenciaCardiaca', 'animo', 'estres', 'fuerza', 'pesoCorporal', 'presionIntraocular'];

interface Props {
  perfil: Perfil;
  sim: Simulador;
  iaConfigurada: boolean;
  onPerfil: (id: string) => void;
}

export function PestanaTripulacion({ perfil, sim, iaConfigurada, onPerfil }: Props) {
  const c = sim.conducta;
  return (
    <div className="pestana-tripulacion">
      <div className="lista-perfiles" role="radiogroup" aria-label="Astronauta">
        {PERFILES.map((p) => {
          const base = p.lineaBase as Partial<Record<TipoSensor, number>>;
          return (
            <button key={p.id} role="radio" aria-checked={perfil.id === p.id} className="tarjeta-perfil" onClick={() => onPerfil(p.id)}>
              <span className="perfil-avatar" aria-hidden>{p.nombre.split(' ').map((x) => x[0]).join('')}</span>
              <span className="perfil-datos">
                <strong>{p.nombre}</strong>
                <span>{p.rol} · {p.historiaClinica.edad} años</span>
                <small>
                  {NIVEL_FORMACION[p.formacionMedica]} · {NIVEL_EXPERIENCIA[p.experiencia]} · tolerancia al estrés {p.toleranciaEstres}
                  {p.propensoPanico ? ' · propenso a pánico' : ''}
                </small>
                {p.historiaClinica.antecedentes.length > 0 && (
                  <small className="perfil-antecedentes">Antecedentes: {p.historiaClinica.antecedentes.map((a) => a.nombre).join(' · ')}</small>
                )}
                {perfil.id === p.id && (
                  <span className="perfil-bases">
                    {BASES.filter((s) => base[s] !== undefined).map((s) => (
                      <span key={s}>{INFO_SENSOR[s].nombre}: <b>{base[s]}</b> {INFO_SENSOR[s].unidad}</span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        <p className="nota">Cambiar de astronauta no altera la detección: solo cómo se le comunica.</p>
      </div>

      <fieldset className="grupos-contexto">
        <legend>Cómo responde el resto</legend>
        <Interruptor etiqueta="Compañero y base responden" descripcion="Si nadie responde, la escalada queda sin respuesta" activo={c.responde} onCambio={(v) => sim.cambiarConducta({ responde: v })} />
        <Interruptor etiqueta="El médico responde" activo={c.medicoResponde} onCambio={(v) => sim.cambiarConducta({ medicoResponde: v })} />
        <Interruptor etiqueta="Tierra responde" descripcion="Con el retardo del destino" activo={c.tierraResponde} onCambio={(v) => sim.cambiarConducta({ tierraResponde: v })} />
        <Segmentado etiqueta="Demora de las respuestas" valor={String(c.demoraMs)} opciones={DEMORAS} onCambio={(v) => sim.cambiarConducta({ demoraMs: Number(v) })} />
      </fieldset>

      <fieldset className="grupos-contexto">
        <legend>IA durante los escenarios</legend>
        <Interruptor
          etiqueta="Evaluar cada hallazgo con IA" activo={sim.iaEnSimulador} onCambio={sim.setIaEnSimulador}
          descripcion={iaConfigurada ? 'Apagada por defecto: cada mensaje sería una consulta' : 'La IA no está configurada'}
        />
      </fieldset>
    </div>
  );
}
