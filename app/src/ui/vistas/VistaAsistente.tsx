/**
 * HIGIA — la sección de inicio. El asistente es la base de la app: desde aquí (o diciendo «Higia»
 * en cualquier momento) se consulta el estado, se piden cosas, se avisa a otros y se navega.
 */
import { useEffect, useRef, useState } from 'react';
import type { Hallazgo, Perfil } from '../../core/tipos';
import { ORDEN_NIVEL } from '../../core/tipos';
import { TEXTO_ACTIVIDAD, TEXTO_ESCUCHA, type Asistente } from '../asistente';
import { OrbeHigia } from '../componentes/AuraHigia';
import { EncabezadoSeccion, Etiqueta, Interruptor } from '../componentes/basicos';
import { Icono } from '../iconos';
import type { Seccion } from '../navegacion';

/** Evaluación o pregunta en curso, para mostrar el progreso y respuestas rápidas. */
export interface EnCurso {
  titulo: string;
  paso?: number;
  total?: number;
  /** Respuestas que se pueden tocar en vez de decirlas. */
  rapidas?: string[];
}

interface Props {
  asistente: Asistente;
  iaActiva: boolean;
  perfil: Perfil;
  hallazgos: Hallazgo[];
  alertasPendientes: number;
  enCurso: EnCurso | null;
  /** Minutos entre preguntas proactivas (0 = apagadas). */
  proactivo: number;
  onProactivo: (minutos: number) => void;
  onPreguntarAhora: () => void;
  onAbrirSimulador: () => void;
  onIr: (s: Seccion) => void;
  onPedirAyuda: () => void;
}

const SUGERENCIAS = [
  '¿Cómo estoy?',
  '¿Qué hora es?',
  'Anoche dormí como cinco horas y me siento cansado',
  'Hazme una evaluación cognitiva',
  'Quiero hacer la maniobra de Valsalva',
  'Dile a Tierra que terminé la reparación',
  'Me duele la cabeza',
  'Pide ayuda',
];

const CLAVE_GUIA = 'higia.guiaVista';
const leerGuia = () => { try { return localStorage.getItem(CLAVE_GUIA) !== 'si'; } catch { return true; } };

export const OPCIONES_PROACTIVO = [
  { min: 2, nombre: 'cada 2 min (demo)' },
  { min: 5, nombre: 'cada 5 min' },
  { min: 15, nombre: 'cada 15 min' },
  { min: 60, nombre: 'cada hora' },
  { min: 0, nombre: 'nunca' },
];

export function VistaAsistente({
  asistente: a, iaActiva, perfil, hallazgos, alertasPendientes, enCurso, proactivo, onProactivo, onPreguntarAhora, onAbrirSimulador, onIr, onPedirAyuda,
}: Props) {
  const [texto, setTexto] = useState('');
  const [verGuia, setVerGuia] = useState(leerGuia);
  const fin = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [a.historial.length, a.pensando]);

  const enviar = (f: string) => { void a.enviar(f); setTexto(''); };
  const cerrarGuia = () => { setVerGuia(false); try { localStorage.setItem(CLAVE_GUIA, 'si'); } catch { /* sin almacenamiento */ } };

  // El historial llega del más nuevo al más viejo; en un chat se lee de arriba hacia abajo.
  const cronologico = [...a.historial].reverse();
  const atencion = hallazgos.filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso);
  const ultimoId = a.historial[0]?.id;

  const titular = a.actividad === 'escuchando' ? 'Te escucho…'
    : a.actividad === 'pensando' ? 'Pensando…'
    : a.actividad === 'hablando' ? 'Higia está hablando'
    : a.estadoEscucha === 'esperando' ? 'Di «Higia» y lo que necesitas'
    : TEXTO_ESCUCHA[a.estadoEscucha];
  const subtitulo = a.actividad === 'escuchando'
    ? (a.parcial ? `«${a.parcial}»` : a.dictando ? 'Habla ahora: no hace falta decir «Higia».' : 'Sigue hablando…')
    : a.actividad === 'hablando' ? 'Toca el orbe o pulsa Esc para callarla.'
    : a.detalleEscucha && !a.problemaVoz ? a.detalleEscucha
    : a.micDisponible ? 'También puedes tocar el micrófono o escribir.' : 'Escríbele: tu navegador no tiene reconocimiento de voz.';

  return (
    <div className="asistente">
      <EncabezadoSeccion
        titulo={`Hola, ${perfil.nombre.split(' ')[0]}`}
        descripcion="Soy Higia. Vigilo tu salud, te aviso cuando algo cambia y manejo la app por ti."
        acciones={(
          <>
            {a.motorVoz === 'local' && <Etiqueta icono="microfono" tono="ia">Voz local</Etiqueta>}
            {iaActiva ? <Etiqueta icono="ia" tono="ia">IA activa</Etiqueta> : <Etiqueta icono="sinConexion">Modo local</Etiqueta>}
            <button className="boton boton-peligro" onClick={onPedirAyuda}><Icono nombre="alerta" /> Pedir ayuda</button>
          </>
        )}
      />

      {verGuia && (
        <div className="guia-inicio" aria-label="Cómo usar Higia">
          <div className="guia-paso">
            <span className="guia-n">1</span>
            <div><strong>Háblale</strong><p>Di «Higia» y tu pedido. El borde de la pantalla se ilumina cuando te escucha.</p></div>
          </div>
          <div className="guia-paso">
            <span className="guia-n">2</span>
            <div><strong>Ella también pregunta</strong><p>De vez en cuando te hace preguntas y evaluaciones cognitivas breves.</p></div>
          </div>
          <div className="guia-paso">
            <span className="guia-n">3</span>
            <div>
              <strong>Simula situaciones</strong>
              <p>Abre el <button className="boton-enlace" onClick={onAbrirSimulador}>Simulador</button> (tecla <kbd>D</kbd>) para ver a Higia reaccionar. <button className="boton-enlace" onClick={cerrarGuia}>Entendido</button></p>
            </div>
          </div>
        </div>
      )}

      <div className="estado-rapido">
        <button className={atencion.length ? 'con-aviso' : ''} onClick={() => onIr('resumen')}>
          <Icono nombre="resumen" tamano={20} />
          <span><strong>{atencion.length ? `${atencion.length} punto${atencion.length > 1 ? 's' : ''} a atender` : 'Todo en orden'}</strong><small>Estado de salud</small></span>
        </button>
        <button className={alertasPendientes ? 'con-alerta' : ''} onClick={() => onIr('mensajes')}>
          <Icono nombre="alerta" tamano={20} />
          <span><strong>{alertasPendientes ? `${alertasPendientes} esperando respuesta` : 'Sin alertas'}</strong><small>Alertas</small></span>
        </button>
        <button onClick={() => onIr('pruebas')}>
          <Icono nombre="pruebas" tamano={20} />
          <span><strong>Pruebas a bordo</strong><small>Cognitiva, reacción, fuerza, Valsalva</small></span>
        </button>
      </div>

      <section className="tarjeta chat" aria-label="Conversación con Higia">
        <div className={`chat-cabecera ${a.actividad}`} aria-live="polite">
          <button
            className="boton-orbe" onClick={a.actividad === 'hablando' ? undefined : a.dictar}
            aria-label={a.actividad === 'hablando' ? TEXTO_ACTIVIDAD.hablando : 'Hablarle a Higia'} title={a.micDisponible ? 'Tocar para hablar' : undefined}
            disabled={!a.micDisponible && a.actividad !== 'hablando'}
          >
            <OrbeHigia actividad={a.actividad} tamano={52} />
          </button>
          <div className="chat-cabecera-texto">
            <strong>{titular}</strong>
            <span className={a.actividad === 'escuchando' && a.parcial ? 'chat-cabecera-parcial' : undefined}>{subtitulo}</span>
          </div>
        </div>
        {a.problemaVoz && (
          <p className="aviso-voz" role="status">
            <Icono nombre="alerta" tamano={14} /> {a.problemaVoz}
          </p>
        )}
        {enCurso && (
          <div className="progreso-eval" role="status">
            <Icono nombre="cerebro" tamano={16} />
            <strong>{enCurso.titulo}</strong>
            {enCurso.total ? (
              <>
                <span className="pista" aria-hidden><span style={{ width: `${(((enCurso.paso ?? 1) - 1) / enCurso.total) * 100}%` }} /></span>
                <span>Pregunta {enCurso.paso} de {enCurso.total}</span>
              </>
            ) : <span className="texto-suave">Responde sin decir «Higia»</span>}
          </div>
        )}
        <div className="chat-historial" aria-live="polite">
          {cronologico.length === 0 && !a.pensando && (
            <div className="chat-bienvenida">
              <p>Prueba decir «Higia» seguido de una de estas frases, o tócala:</p>
              <div className="sugerencias">
                {SUGERENCIAS.map((s) => <button key={s} className="sugerencia" onClick={() => enviar(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {cronologico.map((i) => (
            <div key={i.id} className="chat-turno">
              {i.pregunta && <p className="burbuja burbuja-yo">{i.origen === 'voz' && <Icono nombre="microfono" tamano={13} />} {i.pregunta}</p>}
              <div className={`burbuja burbuja-higia ${i.etiqueta ? 'proactiva' : ''}`}>
                {i.etiqueta
                  ? <span className="burbuja-etiqueta"><Icono nombre="pregunta" tamano={13} /> {i.etiqueta}</span>
                  : <span className="burbuja-autor">{i.fuente === 'ia' ? 'Higia · IA' : 'Higia · local'}</span>}
                <p>{i.respuesta}</p>
                {i.hechos.length > 0 && (
                  <ul className="hechos" aria-label="Lo que hizo Higia">
                    {i.hechos.map((h) => <li key={h}><Icono nombre="check" tamano={14} /> {h}</li>)}
                  </ul>
                )}
                {i.id === ultimoId && enCurso?.rapidas?.length ? (
                  <div className="respuestas-rapidas" aria-label="Respuestas rápidas">
                    {enCurso.rapidas.map((r) => <button key={r} onClick={() => enviar(r)} disabled={a.pensando}>{r}</button>)}
                  </div>
                ) : null}
                {i.nota && <p className="burbuja-nota">{i.nota}</p>}
              </div>
            </div>
          ))}
          {a.pensando && <p className="burbuja burbuja-higia pensando">Higia está pensando…</p>}
          <div ref={fin} />
        </div>

        <form className="chat-redactor" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
          {a.micDisponible && (
            <button
              type="button" className={`boton-mic ${a.dictando ? 'escuchando' : ''}`} onClick={a.dictar} disabled={a.dictando}
              aria-label={a.dictando ? 'Escuchando…' : 'Hablar sin decir «Higia»'} title="Hablar sin decir «Higia»"
            >
              <Icono nombre="microfono" tamano={20} />
            </button>
          )}
          <input
            ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={a.dictando ? 'Escuchando…' : enCurso ? 'Escribe tu respuesta' : 'Escríbele a Higia'} aria-label="Mensaje para Higia"
          />
          <button type="submit" className="boton boton-primario" disabled={a.pensando || !texto.trim()} aria-label="Enviar">
            <Icono nombre="enviar" /> <span className="ocultar-movil">Enviar</span>
          </button>
        </form>
        <div className="chat-opciones">
          <Interruptor
            etiqueta="Escuchar «Higia»"
            descripcion="Solo se activa cuando la nombras: «Higia, pide ayuda», «Higia, ¿qué hora es?»"
            activo={a.escuchaActiva} onCambio={a.alternarEscucha}
          />
          <div className="opcion-proactiva">
            <Icono nombre="pregunta" tamano={16} />
            <label htmlFor="proactivo">Preguntas de Higia</label>
            <select id="proactivo" value={proactivo} onChange={(e) => onProactivo(Number(e.target.value))}>
              {OPCIONES_PROACTIVO.map((o) => <option key={o.min} value={o.min}>{o.nombre}</option>)}
            </select>
            <button type="button" className="boton" onClick={onPreguntarAhora} disabled={!!enCurso || a.pensando}>Pregúntame algo</button>
          </div>
        </div>
      </section>
    </div>
  );
}
