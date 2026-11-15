/**
 * PERFIL E HISTORIA CLÍNICA PREVIA — individualizada por astronauta.
 * La usan la IA (conversación y evaluaciones), los mensajes (antecedentes relevantes) y las
 * comunicaciones de emergencia (alergias, antecedentes y medicación viajan con cada aviso).
 * Se puede editar aquí o hablando: «Higia, soy alérgico al látex».
 */
import { useEffect, useState, type ReactNode } from 'react';
import { INFO_SENSOR, NOMBRE_SISTEMA, SISTEMAS, resumenClinico, type Antecedente, type HistoriaClinica, type Perfil, type SistemaCorporal, type TipoSensor } from '../../core/tipos';
import { Etiqueta } from '../componentes/basicos';
import { Icono, type NombreIcono } from '../iconos';
import { useIdioma, useT } from '../idioma';

interface Props {
  perfil: Perfil;
  onHistoria: (h: HistoriaClinica) => void;
  onRestablecer: () => void;
}

const FORMACION: Record<Perfil['formacionMedica'], string> = { ninguna: 'Sin formación médica', basica: 'Formación básica', medico: 'Médica/o' };
const EXPERIENCIA: Record<Perfil['experiencia'], string> = { novato: 'Novato', intermedio: 'Intermedio', veterano: 'Veterano' };
const TOLERANCIA: Record<Perfil['toleranciaEstres'], string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
const SEXO: Record<HistoriaClinica['sexo'], string> = { femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro' };
const GRUPOS = ['O+', 'O−', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−'];

type CampoLista = 'alergias' | 'medicacion' | 'cirugias' | 'antecedentesFamiliares' | 'notas';

const hora = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function VistaPerfil({ perfil: p, onHistoria, onRestablecer }: Props) {
  const t = useT();
  const { idioma } = useIdioma();
  const h = p.historiaClinica;
  const resumen = idioma === 'en'
    ? `${h.edad} years · blood type ${h.grupoSanguineo} · allergies: ${h.alergias.length ? h.alergias.map((x) => t(x)).join(', ') : t('ninguna conocida')}${h.antecedentes.length ? ` · conditions: ${h.antecedentes.map((a) => t(a.nombre)).join(', ')}` : ''}${h.medicacion.length ? ` · medication: ${h.medicacion.map((x) => t(x)).join(', ')}` : ''}`
    : resumenClinico(h);
  const [confirmar, setConfirmar] = useState(false);
  const cambiarLista = (campo: CampoLista, items: string[]) => onHistoria({ ...h, [campo]: items });
  const iniciales = p.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('');
  const grupos = GRUPOS.includes(h.grupoSanguineo) ? GRUPOS : [h.grupoSanguineo, ...GRUPOS];

  // La confirmación de restablecer se cancela sola si no se usa.
  useEffect(() => {
    if (!confirmar) return;
    const t = setTimeout(() => setConfirmar(false), 6000);
    return () => clearTimeout(t);
  }, [confirmar]);

  return (
    <div className="perfil-vista">
      <header className="encabezado-seccion">
        <div>
          <h1>{t('Perfil')}</h1>
          <p>{t('Tu historia clínica previa a la misión. Higia la usa para responderte y la envía con cada aviso de emergencia.')}</p>
        </div>
        <div className="encabezado-acciones">
          {confirmar ? (
            <div className="confirmar" role="group" aria-label={t('Confirmar restablecer')}>
              <span>{t('¿Descartar tus cambios?')}</span>
              <button className="boton boton-fantasma" onClick={() => setConfirmar(false)}>{t('Cancelar')}</button>
              <button className="boton boton-peligro" onClick={() => { onRestablecer(); setConfirmar(false); }}>{t('Restablecer')}</button>
            </div>
          ) : (
            <button className="boton" onClick={() => setConfirmar(true)} title={t('Volver a la historia original del perfil')}>
              <Icono nombre="reiniciar" /> {t('Restablecer')}
            </button>
          )}
        </div>
      </header>

      <div className="perfil">
        <aside className="perfil-lateral">
          <section className="tarjeta ficha" aria-labelledby="titulo-ficha">
            <div className="ficha-cab">
              <span className="ficha-avatar" aria-hidden>{iniciales}</span>
              <div className="ficha-nombre">
                <h2 id="titulo-ficha">{p.nombre}</h2>
                <p className="texto-suave">{t(p.rol)}</p>
                <span className="ficha-id">{p.id}</span>
              </div>
            </div>

            <div className="datos-clave">
              <label className="dato-clave">
                <span>{t('Edad')}</span>
                <CampoEdad valor={h.edad} onCambio={(edad) => onHistoria({ ...h, edad })} />
              </label>
              <label className="dato-clave">
                <span>{t('Sexo')}</span>
                <select value={h.sexo} onChange={(e) => onHistoria({ ...h, sexo: e.target.value as HistoriaClinica['sexo'] })}>
                  {Object.entries(SEXO).map(([v, n]) => <option key={v} value={v}>{t(n)}</option>)}
                </select>
              </label>
              <label className="dato-clave dato-sangre">
                <span>{t('Grupo sanguíneo')}</span>
                <select value={h.grupoSanguineo} onChange={(e) => onHistoria({ ...h, grupoSanguineo: e.target.value })}>
                  {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="tarjeta tarjeta-emergencia" aria-labelledby="titulo-emergencia">
            <h2 id="titulo-emergencia" className="titulo-tarjeta"><Icono nombre="escudo" tamano={16} /> {t('Lo que recibe el equipo médico')}</h2>
            <p>{resumen}</p>
            <small>{t('Se adjunta automáticamente a cada aviso de emergencia.')}</small>
          </section>

          <section className="tarjeta tarjeta-mision" aria-labelledby="titulo-mision">
            <h2 id="titulo-mision" className="titulo-tarjeta">{t('Perfil de misión')}</h2>
            <ul className="lista-mision">
              <ItemMision icono="info" nombre={t('Formación médica')} valor={t(FORMACION[p.formacionMedica])} />
              <ItemMision icono="usuario" nombre={t('Experiencia')} valor={t(EXPERIENCIA[p.experiencia])} />
              <ItemMision icono="cerebro" nombre={t('Tolerancia al estrés')} valor={`${t(TOLERANCIA[p.toleranciaEstres])}${p.propensoPanico ? ` · ${t('propenso al pánico')}` : ''}`} />
              <ItemMision icono="reloj" nombre={t('Horario de sueño')} valor={t('{a} a {b}', { a: hora(p.horarioSueno.inicio), b: hora(p.horarioSueno.fin) })} />
            </ul>
            <details className="linea-base">
              <summary>{t('Valores habituales')} <span className="texto-suave">({Object.keys(p.lineaBase).length})</span></summary>
              <dl>
                {Object.entries(p.lineaBase).map(([s, v]) => (
                  <div key={s}>
                    <dt>{t(INFO_SENSOR[s as TipoSensor].nombre)}</dt>
                    <dd>{v} <small>{INFO_SENSOR[s as TipoSensor].unidad}</small></dd>
                  </div>
                ))}
              </dl>
              <p className="nota">{t('Higia compara tus datos contra estos valores, no contra un promedio general.')}</p>
            </details>
          </section>
        </aside>

        <div className="perfil-principal">
          <p className="consejo-voz">
            <Icono nombre="microfono" tamano={16} />
            <span>{t('También puedes dictarlo:')} <em>{t('«Higia, soy alérgico al látex»')}</em> {t('o')} <em>{t('«Higia, tomo ibuprofeno»')}</em>.</span>
          </p>

          <Bloque id="alergias" titulo={t('Alergias')} icono="alerta" cantidad={h.alergias.length} tono="alerta"
            descripcion={t('Se destacan en rojo en cada aviso de emergencia.')}>
            <ListaEditable items={h.alergias} onCambio={(v) => cambiarLista('alergias', v)} vacio={t('Ninguna conocida')} placeholder={t('Ej.: penicilina, látex')} nombre={t('alergia')} alerta />
          </Bloque>

          <Bloque id="antecedentes" titulo={t('Antecedentes y condiciones')} icono="corazon" cantidad={h.antecedentes.length}
            descripcion={t('Asócialos a un sistema del cuerpo para que se destaquen en sus mensajes.')}>
            <Antecedentes items={h.antecedentes} onCambio={(antecedentes) => onHistoria({ ...h, antecedentes })} />
          </Bloque>

          <div className="perfil-pares">
            <Bloque id="medicacion" titulo={t('Medicación')} icono="documento" cantidad={h.medicacion.length}>
              <ListaEditable items={h.medicacion} onCambio={(v) => cambiarLista('medicacion', v)} vacio={t('Sin medicación')} placeholder={t('Ej.: ibuprofeno 400 mg')} nombre={t('medicación')} />
            </Bloque>
            <Bloque id="cirugias" titulo={t('Cirugías')} icono="mano" cantidad={h.cirugias.length}>
              <ListaEditable items={h.cirugias} onCambio={(v) => cambiarLista('cirugias', v)} vacio={t('Sin cirugías')} placeholder={t('Ej.: apendicectomía (2015)')} nombre={t('cirugía')} />
            </Bloque>
            <Bloque id="familiares" titulo={t('Antecedentes familiares')} icono="personas" cantidad={h.antecedentesFamiliares.length}>
              <ListaEditable items={h.antecedentesFamiliares} onCambio={(v) => cambiarLista('antecedentesFamiliares', v)} vacio={t('Sin datos')} placeholder={t('Ej.: diabetes (madre)')} nombre={t('antecedente familiar')} />
            </Bloque>
            <Bloque id="notas" titulo={t('Notas')} icono="documento" cantidad={h.notas.length}>
              <ListaEditable items={h.notas} onCambio={(v) => cambiarLista('notas', v)} vacio={t('Sin notas')} placeholder={t('Ej.: vacuna antigripal al día')} nombre={t('nota')} />
            </Bloque>
          </div>

          <p className="nota perfil-nota"><Icono nombre="candado" tamano={14} /> {t('Los cambios se guardan solo en este dispositivo. A la IA se le envía la historia sin tu nombre.')}</p>
        </div>
      </div>
    </div>
  );
}

function ItemMision({ icono, nombre, valor }: { icono: NombreIcono; nombre: string; valor: string }) {
  return (
    <li>
      <Icono nombre={icono} tamano={16} />
      <span>{nombre}</span>
      <strong>{valor}</strong>
    </li>
  );
}

function Bloque({ id, titulo, icono, cantidad, descripcion, tono, children }: {
  id: string; titulo: string; icono: NombreIcono; cantidad: number; descripcion?: string; tono?: 'alerta'; children: ReactNode;
}) {
  return (
    <section className={`tarjeta bloque ${tono ? `bloque-${tono}` : ''}`} aria-labelledby={`titulo-${id}`}>
      <div className="bloque-cab">
        <span className="bloque-icono" aria-hidden><Icono nombre={icono} tamano={16} /></span>
        <div>
          <h2 id={`titulo-${id}`} className="titulo-tarjeta">{titulo} {cantidad > 0 && <span className="contador-bloque">{cantidad}</span>}</h2>
          {descripcion && <p className="nota">{descripcion}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Edad editable sin saltos: deja borrar y escribir, y guarda al ser válida. */
function CampoEdad({ valor, onCambio }: { valor: number; onCambio: (v: number) => void }) {
  const t = useT();
  const [borrador, setBorrador] = useState(String(valor));
  useEffect(() => setBorrador(String(valor)), [valor]);
  const confirmar = () => {
    const n = Number(borrador);
    if (Number.isFinite(n) && n >= 18 && n <= 90) onCambio(Math.round(n));
    else setBorrador(String(valor));
  };
  return (
    <span className="campo-edad">
      <input
        type="number" inputMode="numeric" min={18} max={90} value={borrador}
        onChange={(e) => {
          setBorrador(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value && n >= 18 && n <= 90) onCambio(Math.round(n));
        }}
        onBlur={confirmar}
      />
      <small>{t('años')}</small>
    </span>
  );
}

function ListaEditable({ items, onCambio, vacio, placeholder, nombre, alerta }: {
  items: string[]; onCambio: (v: string[]) => void; vacio: string; placeholder: string; nombre: string; alerta?: boolean;
}) {
  const t = useT();
  const [nuevo, setNuevo] = useState('');
  const repetido = items.some((x) => x.toLowerCase() === nuevo.trim().toLowerCase());
  const agregar = () => {
    const v = nuevo.trim();
    if (!v || repetido) return;
    onCambio([...items, v]);
    setNuevo('');
  };
  return (
    <>
      {items.length ? (
        <ul className="lista-editable">
          {items.map((i) => (
            <li key={i} className={alerta ? 'alerta' : ''}>
              <span>{t(i)}</span>
              <button className="boton-icono" onClick={() => onCambio(items.filter((x) => x !== i))} aria-label={t('Quitar {x}', { x: i })} title={t('Quitar')}>
                <Icono nombre="cerrar" tamano={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="lista-vacia">{vacio}</p>}
      <form className="agregar" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder={placeholder} aria-label={t('Agregar {nombre}', { nombre })} enterKeyHint="done" />
        <button type="submit" className="boton" disabled={!nuevo.trim() || repetido} aria-label={t('Agregar {nombre}', { nombre })}>
          <Icono nombre="mas" tamano={16} /> <span>{t('Agregar')}</span>
        </button>
      </form>
      {repetido && nuevo.trim() && <p className="nota agregar-aviso" role="status">{t('Ya está en la lista.')}</p>}
    </>
  );
}

function Antecedentes({ items, onCambio }: { items: Antecedente[]; onCambio: (v: Antecedente[]) => void }) {
  const t = useT();
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
                <strong>{t(a.nombre)}</strong>
                {a.detalle && <p className="texto-suave">{t(a.detalle)}</p>}
              </div>
              {a.sistema && <Etiqueta>{t(NOMBRE_SISTEMA[a.sistema])}</Etiqueta>}
              <button className="boton-icono" onClick={() => onCambio(items.filter((_, k) => k !== i))} aria-label={t('Quitar {x}', { x: a.nombre })} title={t('Quitar')}>
                <Icono nombre="cerrar" tamano={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="lista-vacia">{t('Sin antecedentes')}</p>}
      <form className="agregar agregar-antecedente" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('Ej.: asma leve')} aria-label={t('Agregar antecedente')} />
        <select value={sistema} onChange={(e) => setSistema(e.target.value as SistemaCorporal | '')} aria-label={t('Sistema del cuerpo')}>
          <option value="">{t('Sistema (opcional)')}</option>
          {SISTEMAS.map((s) => <option key={s} value={s}>{t(NOMBRE_SISTEMA[s])}</option>)}
        </select>
        <button type="submit" className="boton" disabled={!nombre.trim()} aria-label={t('Agregar antecedente')}>
          <Icono nombre="mas" tamano={16} /> <span>{t('Agregar')}</span>
        </button>
      </form>
    </>
  );
}
