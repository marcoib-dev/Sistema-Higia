/**
 * PERFIL E HISTORIA CLÍNICA PREVIA — individualizada por astronauta.
 * La usan la IA (conversación y evaluaciones), los mensajes (antecedentes relevantes) y las
 * comunicaciones de emergencia (alergias, antecedentes y medicación viajan con cada aviso).
 * Se puede editar aquí o hablando: «Higia, soy alérgico al látex».
 */
import { Fragment, useState } from 'react';
import { NOMBRE_SISTEMA, SISTEMAS, type Antecedente, type HistoriaClinica, type Perfil, type SistemaCorporal } from '../../core/tipos';
import { EncabezadoSeccion, Etiqueta } from '../componentes/basicos';
import { Icono } from '../iconos';

interface Props {
  perfil: Perfil;
  onHistoria: (h: HistoriaClinica) => void;
  onRestablecer: () => void;
}

const FORMACION: Record<Perfil['formacionMedica'], string> = { ninguna: 'Sin formación médica', basica: 'Formación básica', medico: 'Médica/o' };
const EXPERIENCIA: Record<Perfil['experiencia'], string> = { novato: 'Novato', intermedio: 'Intermedio', veterano: 'Veterano' };
const SEXO: Record<HistoriaClinica['sexo'], string> = { femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro' };
const SENSOR: Record<string, string> = { frecuenciaCardiaca: 'Pulso en reposo', animo: 'Ánimo habitual', estres: 'Estrés habitual' };
const UNIDAD: Record<string, string> = { frecuenciaCardiaca: 'lpm', animo: '/10', estres: '/100' };

type CampoLista = 'alergias' | 'medicacion' | 'cirugias' | 'antecedentesFamiliares' | 'notas';

export function VistaPerfil({ perfil: p, onHistoria, onRestablecer }: Props) {
  const h = p.historiaClinica;
  const cambiarLista = (campo: CampoLista, items: string[]) => onHistoria({ ...h, [campo]: items });

  return (
    <>
      <EncabezadoSeccion
        titulo="Perfil"
        descripcion="Historia clínica previa a la misión. Higia la tiene en cuenta en sus respuestas y la envía con cada aviso de emergencia."
        acciones={<button className="boton" onClick={onRestablecer} title="Volver a la historia original del perfil"><Icono nombre="recordatorio" /> Restablecer</button>}
      />

      <div className="perfil">
        <section className="tarjeta" aria-labelledby="titulo-ficha">
          <div className="ficha-cab">
            <span className="ficha-avatar" aria-hidden>{p.nombre.split(' ').map((x) => x[0]).join('')}</span>
            <div>
              <h2 id="titulo-ficha">{p.nombre}</h2>
              <p className="texto-suave">{p.rol} · {p.id}</p>
            </div>
          </div>
          <dl className="ficha-datos">
            <dt>Edad</dt>
            <dd><input type="number" min={18} max={90} value={h.edad} onChange={(e) => onHistoria({ ...h, edad: Number(e.target.value) || h.edad })} aria-label="Edad" /> años</dd>
            <dt>Sexo</dt>
            <dd>
              <select value={h.sexo} onChange={(e) => onHistoria({ ...h, sexo: e.target.value as HistoriaClinica['sexo'] })} aria-label="Sexo">
                {Object.entries(SEXO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </dd>
            <dt>Grupo sanguíneo</dt>
            <dd><input value={h.grupoSanguineo} onChange={(e) => onHistoria({ ...h, grupoSanguineo: e.target.value })} aria-label="Grupo sanguíneo" className="corto" /></dd>
            <dt>Formación médica</dt><dd>{FORMACION[p.formacionMedica]}</dd>
            <dt>Experiencia</dt><dd>{EXPERIENCIA[p.experiencia]}</dd>
            <dt>Tolerancia al estrés</dt><dd>{p.toleranciaEstres}{p.propensoPanico ? ' · propenso al pánico' : ''}</dd>
            <dt>Horario de sueño</dt><dd>{p.horarioSueno.inicio}:00 a {p.horarioSueno.fin}:00</dd>
            {Object.entries(p.lineaBase).map(([s, v]) => (
              <Fragment key={s}><dt>{SENSOR[s] ?? s}</dt><dd>{v} {UNIDAD[s] ?? ''}</dd></Fragment>
            ))}
          </dl>
        </section>

        <section className="tarjeta" aria-labelledby="titulo-alergias">
          <h2 id="titulo-alergias" className="titulo-tarjeta">Alergias</h2>
          <ListaEditable items={h.alergias} onCambio={(v) => cambiarLista('alergias', v)} vacio="Ninguna conocida" placeholder="Agregar alergia" alerta />
        </section>

        <section className="tarjeta tarjeta-ancha" aria-labelledby="titulo-antecedentes">
          <h2 id="titulo-antecedentes" className="titulo-tarjeta">Antecedentes y condiciones</h2>
          <Antecedentes items={h.antecedentes} onCambio={(antecedentes) => onHistoria({ ...h, antecedentes })} />
        </section>

        <section className="tarjeta" aria-labelledby="titulo-medicacion">
          <h2 id="titulo-medicacion" className="titulo-tarjeta">Medicación</h2>
          <ListaEditable items={h.medicacion} onCambio={(v) => cambiarLista('medicacion', v)} vacio="Sin medicación" placeholder="Agregar medicación" />
        </section>

        <section className="tarjeta" aria-labelledby="titulo-cirugias">
          <h2 id="titulo-cirugias" className="titulo-tarjeta">Cirugías</h2>
          <ListaEditable items={h.cirugias} onCambio={(v) => cambiarLista('cirugias', v)} vacio="Sin cirugías" placeholder="Agregar cirugía" />
        </section>

        <section className="tarjeta" aria-labelledby="titulo-familiares">
          <h2 id="titulo-familiares" className="titulo-tarjeta">Antecedentes familiares</h2>
          <ListaEditable items={h.antecedentesFamiliares} onCambio={(v) => cambiarLista('antecedentesFamiliares', v)} vacio="Sin datos" placeholder="Agregar antecedente familiar" />
        </section>

        <section className="tarjeta" aria-labelledby="titulo-notas">
          <h2 id="titulo-notas" className="titulo-tarjeta">Notas</h2>
          <ListaEditable items={h.notas} onCambio={(v) => cambiarLista('notas', v)} vacio="Sin notas" placeholder="Agregar nota" />
        </section>
      </div>
      <p className="nota perfil-nota"><Icono nombre="candado" tamano={14} /> Los cambios se guardan solo en este dispositivo. A la IA se le envía la historia sin el nombre del astronauta.</p>
    </>
  );
}

function ListaEditable({ items, onCambio, vacio, placeholder, alerta }: {
  items: string[]; onCambio: (v: string[]) => void; vacio: string; placeholder: string; alerta?: boolean;
}) {
  const [nuevo, setNuevo] = useState('');
  const agregar = () => {
    const v = nuevo.trim();
    if (v && !items.includes(v)) onCambio([...items, v]);
    setNuevo('');
  };
  return (
    <>
      {items.length ? (
        <ul className="lista-editable">
          {items.map((i) => (
            <li key={i} className={alerta ? 'alerta' : ''}>
              <span>{i}</span>
              <button className="boton-icono" onClick={() => onCambio(items.filter((x) => x !== i))} aria-label={`Quitar ${i}`}><Icono nombre="cerrar" tamano={14} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="texto-suave">{vacio}</p>}
      <form className="agregar" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        <button type="submit" className="boton" disabled={!nuevo.trim()}>Agregar</button>
      </form>
    </>
  );
}

function Antecedentes({ items, onCambio }: { items: Antecedente[]; onCambio: (v: Antecedente[]) => void }) {
  const [nombre, setNombre] = useState('');
  const [sistema, setSistema] = useState<SistemaCorporal | ''>('');
  const agregar = () => {
    if (!nombre.trim()) return;
    onCambio([...items, { nombre: nombre.trim(), sistema: sistema || undefined }]);
    setNombre('');
    setSistema('');
  };
  return (
    <>
      {items.length ? (
        <ul className="lista-antecedentes">
          {items.map((a, i) => (
            <li key={`${a.nombre}-${i}`}>
              <div>
                <strong>{a.nombre}</strong>
                {a.detalle && <p className="texto-suave">{a.detalle}</p>}
              </div>
              {a.sistema && <Etiqueta>{NOMBRE_SISTEMA[a.sistema]}</Etiqueta>}
              <button className="boton-icono" onClick={() => onCambio(items.filter((_, k) => k !== i))} aria-label={`Quitar ${a.nombre}`}><Icono nombre="cerrar" tamano={14} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="texto-suave">Sin antecedentes</p>}
      <form className="agregar" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Agregar antecedente" aria-label="Agregar antecedente" />
        <select value={sistema} onChange={(e) => setSistema(e.target.value as SistemaCorporal | '')} aria-label="Sistema del cuerpo">
          <option value="">Sistema (opcional)</option>
          {SISTEMAS.map((s) => <option key={s} value={s}>{NOMBRE_SISTEMA[s]}</option>)}
        </select>
        <button type="submit" className="boton" disabled={!nombre.trim()}>Agregar</button>
      </form>
      <p className="nota">Un antecedente asociado a un sistema se destaca en los mensajes de ese sistema.</p>
    </>
  );
}
