/**
 * HIGIA — la sección de inicio. El asistente es la base de la app: desde aquí (o diciendo «Higia»
 * en cualquier momento) se consulta el estado, se piden cosas, se avisa a otros y se navega.
 */
import { useEffect, useRef, useState } from 'react';
import type { Hallazgo, Perfil } from '../../core/tipos';
import { ORDEN_NIVEL } from '../../core/tipos';
import { TEXTO_ACTIVIDAD, TEXTO_ESCUCHA, type Asistente } from '../asistente';
import { OrbeHigia } from '../componentes/AuraHigia';
import { Interruptor } from '../componentes/basicos';
import { Icono, type NombreIcono } from '../iconos';
import { useT } from '../idioma';
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

/** Ideas para empezar, agrupadas por lo que resuelven. */
const SUGERENCIAS: { texto: string; icono: NombreIcono }[] = [
  { texto: '¿Cómo estoy?', icono: 'resumen' },
  { texto: 'Me duele la cabeza', icono: 'corazon' },
  { texto: 'Anoche dormí como cinco horas y me siento cansado', icono: 'reloj' },
  { texto: 'Hazme una evaluación cognitiva', icono: 'cerebro' },
  { texto: 'Quiero hacer la maniobra de Valsalva', icono: 'pruebas' },
  { texto: 'Dile a Tierra que terminé la reparación', icono: 'enviar' },
  { texto: '¿Qué hora es?', icono: 'reloj' },
  { texto: 'Pide ayuda', icono: 'alerta' },
];

const CLAVE_GUIA = 'higia.guiaVista';
const leerGuia = () => { try { return localStorage.getItem(CLAVE_GUIA) !== 'si'; } catch { return true; } };

export const OPCIONES_PROACTIVO = [
  { min: 2, nombre: 'Cada 2 min (demo)' },
  { min: 5, nombre: 'Cada 5 min' },
  { min: 15, nombre: 'Cada 15 min' },
  { min: 60, nombre: 'Cada hora' },
  { min: 0, nombre: 'Nunca' },
];

export function VistaAsistente({
  asistente: a, iaActiva, perfil, hallazgos, alertasPendientes, enCurso, proactivo, onProactivo, onPreguntarAhora, onAbrirSimulador, onIr, onPedirAyuda,
}: Props) {
  const t = useT();
  const [texto, setTexto] = useState('');
  const [verGuia, setVerGuia] = useState(leerGuia);
  const [verAjustes, setVerAjustes] = useState(false);
  const historial = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // Desplaza solo la conversación (no la página) hasta el último mensaje.
  useEffect(() => {
    const h = historial.current;
    if (h) h.scrollTo({ top: h.scrollHeight, behavior: 'smooth' });
  }, [a.historial.length, a.pensando]);

  const enviar = (f: string) => {
    if (!f.trim()) return;
    void a.enviar(f);
    setTexto('');
  };
  const cerrarGuia = () => { setVerGuia(false); try { localStorage.setItem(CLAVE_GUIA, 'si'); } catch { /* sin almacenamiento */ } };
  const abrirGuia = () => { setVerGuia(true); try { localStorage.removeItem(CLAVE_GUIA); } catch { /* sin almacenamiento */ } };

  // El historial llega del más nuevo al más viejo; en un chat se lee de arriba hacia abajo.
  const cronologico = [...a.historial].reverse();
  const atencion = hallazgos.filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso);
  const ultimoId = a.historial[0]?.id;
  const hayRapidas = !!enCurso?.rapidas?.length;
  const nombreProactivo = OPCIONES_PROACTIVO.find((o) => o.min === proactivo)?.nombre ?? '';

  const titular = a.actividad === 'escuchando' ? t('Te escucho…')
    : a.actividad === 'pensando' ? t('Pensando…')
    : a.actividad === 'hablando' ? t('Higia está hablando')
    : a.estadoEscucha === 'esperando' ? t('Di «Higia» y lo que necesitas')
    : t(TEXTO_ESCUCHA[a.estadoEscucha]);
  const subtitulo = a.actividad === 'escuchando'
    ? (a.parcial ? `«${a.parcial}»` : a.dictando ? t('Habla ahora: no hace falta decir «Higia».') : t('Sigue hablando…'))
    : a.actividad === 'hablando' ? t('Toca el orbe o pulsa Esc para callarla.')
    : a.detalleEscucha && !a.problemaVoz ? a.detalleEscucha
    : a.micDisponible ? t('Toca el orbe para hablar, o escríbele abajo.') : t('Escríbele: tu navegador no tiene reconocimiento de voz.');

  return (
    <div className="asistente">
      <header className="asistente-cab">
        <div className="asistente-saludo">
          <h1>{t('Hola, {nombre}', { nombre: perfil.nombre.split(' ')[0] })}</h1>
          <p>{t('Soy Higia. Vigilo tu salud, te aviso cuando algo cambia y manejo la app por ti.')}</p>
        </div>
        <div className="asistente-acciones">
          <span className={`estado-motor ${iaActiva ? 'ia' : ''}`} title={a.motorVoz === 'local' ? t('Reconocimiento de voz en el dispositivo') : undefined}>
            <Icono nombre={iaActiva ? 'ia' : 'sinConexion'} tamano={14} />
            {iaActiva ? t('IA activa') : t('Modo local')}
            {a.motorVoz === 'local' && <><span aria-hidden>·</span><Icono nombre="microfono" tamano={13} /> {t('Voz local')}</>}
          </span>
          {!verGuia && (
            <button className="boton-icono" onClick={abrirGuia} aria-label={t('Cómo usar Higia')} title={t('Cómo usar Higia')}>
              <Icono nombre="pregunta" />
            </button>
          )}
          <button className="boton boton-peligro boton-ayuda" onClick={onPedirAyuda}><Icono nombre="alerta" /> {t('Pedir ayuda')}</button>
        </div>
      </header>

      {verGuia && (
        <section className="guia-inicio" aria-labelledby="titulo-guia">
          <div className="guia-cab">
            <h2 id="titulo-guia">{t('Cómo usar Higia')}</h2>
            <button className="boton-icono" onClick={cerrarGuia} aria-label={t('Cerrar la guía')}><Icono nombre="cerrar" tamano={16} /></button>
          </div>
          <ol className="guia-pasos">
            <li className="guia-paso">
              <span className="guia-n" aria-hidden><Icono nombre="microfono" tamano={16} /></span>
              <div><strong>{t('Háblale')}</strong><p>{t('Di «Higia» y tu pedido. El borde de la pantalla se ilumina cuando te escucha.')}</p></div>
            </li>
            <li className="guia-paso">
              <span className="guia-n" aria-hidden><Icono nombre="pregunta" tamano={16} /></span>
              <div><strong>{t('Ella también pregunta')}</strong><p>{t('De vez en cuando te hace preguntas y evaluaciones cognitivas breves.')}</p></div>
            </li>
            <li className="guia-paso">
              <span className="guia-n" aria-hidden><Icono nombre="demo" tamano={16} /></span>
              <div>
                <strong>{t('Simula situaciones')}</strong>
                <p>{t('Abre el')} <button className="boton-enlace" onClick={onAbrirSimulador}>{t('Simulador')}</button> ({t('tecla')} <kbd>D</kbd>) {t('para ver a Higia reaccionar.')}</p>
              </div>
            </li>
          </ol>
          <button className="boton guia-entendido" onClick={cerrarGuia}><Icono nombre="check" /> {t('Entendido')}</button>
        </section>
      )}

      <nav className="estado-rapido" aria-label={t('Accesos rápidos')}>
        <button className={atencion.length ? 'con-aviso' : 'con-ok'} onClick={() => onIr('resumen')}>
          <span className="estado-icono"><Icono nombre="resumen" tamano={20} /></span>
          <span><strong>{atencion.length ? t('{n} punto(s) a atender', { n: atencion.length }) : t('Todo en orden')}</strong><small>{t('Estado de salud')}</small></span>
          <Icono nombre="flecha" tamano={16} />
        </button>
        <button className={alertasPendientes ? 'con-alerta' : ''} onClick={() => onIr('mensajes')}>
          <span className="estado-icono"><Icono nombre="mensajes" tamano={20} /></span>
          <span><strong>{alertasPendientes ? t('{n} sin responder', { n: alertasPendientes }) : t('Sin alertas')}</strong><small>{t('Alertas')}</small></span>
          <Icono nombre="flecha" tamano={16} />
        </button>
        <button onClick={() => onIr('pruebas')}>
          <span className="estado-icono"><Icono nombre="pruebas" tamano={20} /></span>
          <span><strong>{t('Pruebas a bordo')}</strong><small>{t('Cognitiva, reacción, fuerza…')}</small></span>
          <Icono nombre="flecha" tamano={16} />
        </button>
      </nav>

      <section className="tarjeta chat" aria-label={t('Conversación con Higia')}>
        <div className={`chat-cabecera ${a.actividad}`} aria-live="polite">
          <button
            className="boton-orbe" onClick={a.actividad === 'hablando' ? undefined : a.dictar}
            aria-label={a.actividad === 'hablando' ? t(TEXTO_ACTIVIDAD.hablando) : t('Hablarle a Higia')} title={a.micDisponible ? t('Tocar para hablar') : undefined}
            disabled={!a.micDisponible && a.actividad !== 'hablando'}
          >
            <OrbeHigia actividad={a.actividad} tamano={52} />
          </button>
          <div className="chat-cabecera-texto">
            <strong>{titular}</strong>
            <span className={a.actividad === 'escuchando' && a.parcial ? 'chat-cabecera-parcial' : undefined}>{subtitulo}</span>
          </div>
          <button
            type="button" className={`boton-icono boton-ajustes ${verAjustes ? 'abierto' : ''}`} onClick={() => setVerAjustes((v) => !v)}
            aria-expanded={verAjustes} aria-controls="ajustes-higia" aria-label={t('Ajustes de Higia')} title={t('Ajustes de Higia')}
          >
            <Icono nombre="demo" />
          </button>
        </div>

        {verAjustes && (
          <div className="chat-ajustes" id="ajustes-higia">
            <Interruptor
              etiqueta={t('Escuchar «Higia»')}
              descripcion={t('Solo se activa cuando la nombras: «Higia, pide ayuda».')}
              activo={a.escuchaActiva} onCambio={a.alternarEscucha}
            />
            <div className="ajuste-proactivo">
              <label htmlFor="proactivo">
                <span>{t('Preguntas de Higia')}</span>
                <small>{t('Con qué frecuencia te pregunta cómo estás.')}</small>
              </label>
              <div className="ajuste-proactivo-controles">
                <select id="proactivo" value={proactivo} onChange={(e) => onProactivo(Number(e.target.value))}>
                  {OPCIONES_PROACTIVO.map((o) => <option key={o.min} value={o.min}>{t(o.nombre)}</option>)}
                </select>
                <button type="button" className="boton" onClick={() => { onPreguntarAhora(); setVerAjustes(false); }} disabled={!!enCurso || a.pensando}>
                  {t('Pregúntame ahora')}
                </button>
              </div>
            </div>
          </div>
        )}

        {a.problemaVoz && (
          <p className="aviso-voz" role="status">
            <Icono nombre="alerta" tamano={14} /> {a.problemaVoz}
          </p>
        )}
        {enCurso && (
          <div className="progreso-eval" role="status">
            <Icono nombre="cerebro" tamano={16} />
            <strong>{t(enCurso.titulo)}</strong>
            {enCurso.total ? (
              <>
                <span className="pista" aria-hidden><span style={{ width: `${(((enCurso.paso ?? 1) - 1) / enCurso.total) * 100}%` }} /></span>
                <span className="progreso-paso">{enCurso.paso}/{enCurso.total}</span>
              </>
            ) : <span className="texto-suave">{t('Responde sin decir «Higia»')}</span>}
          </div>
        )}

        <div className="chat-historial" ref={historial} aria-live="polite">
          {cronologico.length === 0 && !a.pensando && (
            <div className="chat-bienvenida">
              <p className="chat-bienvenida-titulo">{t('¿En qué te ayudo?')}</p>
              <p className="texto-suave">{t('Toca una idea o di «Higia» seguido de la frase.')}</p>
              <div className="sugerencias">
                {SUGERENCIAS.map((s) => (
                  <button key={s.texto} className="sugerencia" onClick={() => enviar(t(s.texto))}>
                    <Icono nombre={s.icono} tamano={16} /> <span>{t(s.texto)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {cronologico.map((i) => (
            <div key={i.id} className="chat-turno">
              {i.pregunta && <p className="burbuja burbuja-yo">{i.origen === 'voz' && <Icono nombre="microfono" tamano={13} />} {i.pregunta}</p>}
              <div className={`burbuja burbuja-higia ${i.etiqueta ? 'proactiva' : ''}`}>
                {i.etiqueta
                  ? <span className="burbuja-etiqueta"><Icono nombre="pregunta" tamano={13} /> {t(i.etiqueta)}</span>
                  : <span className="burbuja-autor">{i.fuente === 'ia' ? 'Higia · IA' : 'Higia · local'}</span>}
                <p>{i.respuesta}</p>
                {i.hechos.length > 0 && (
                  <ul className="hechos" aria-label={t('Lo que hizo Higia')}>
                    {i.hechos.map((h) => <li key={h}><Icono nombre="check" tamano={14} /> {h}</li>)}
                  </ul>
                )}
                {i.id === ultimoId && hayRapidas ? (
                  <div className="respuestas-rapidas" aria-label={t('Respuestas rápidas')}>
                    {enCurso!.rapidas!.map((r) => <button key={r} onClick={() => enviar(t(r))} disabled={a.pensando}>{t(r)}</button>)}
                  </div>
                ) : null}
                {i.nota && <p className="burbuja-nota">{i.nota}</p>}
              </div>
            </div>
          ))}
          {a.pensando && (
            <p className="burbuja burbuja-higia pensando" aria-label={t('Higia está pensando')}>
              <span className="puntos-escribiendo" aria-hidden><span /><span /><span /></span>
            </p>
          )}
        </div>

        {cronologico.length > 0 && !enCurso && (
          <div className="sugerencias-fila" aria-label={t('Ideas')}>
            {SUGERENCIAS.slice(0, 6).map((s) => (
              <button key={s.texto} className="sugerencia" onClick={() => enviar(t(s.texto))} disabled={a.pensando}>
                <Icono nombre={s.icono} tamano={14} /> {t(s.texto)}
              </button>
            ))}
          </div>
        )}

        <form className="chat-redactor" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
          {a.micDisponible && (
            <button
              type="button" className={`boton-mic ${a.dictando ? 'escuchando' : ''}`} onClick={a.dictar} disabled={a.dictando}
              aria-label={a.dictando ? t('Escuchando…') : t('Hablar sin decir «Higia»')} title={t('Hablar sin decir «Higia»')}
            >
              <Icono nombre="microfono" tamano={20} />
            </button>
          )}
          <input
            ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} enterKeyHint="send"
            placeholder={a.dictando ? t('Escuchando…') : enCurso ? t('Escribe tu respuesta') : t('Escríbele a Higia')} aria-label={t('Mensaje para Higia')}
          />
          <button type="submit" className="boton boton-primario boton-enviar" disabled={a.pensando || !texto.trim()} aria-label={t('Enviar')}>
            <Icono nombre="enviar" /> <span className="ocultar-movil">{t('Enviar')}</span>
          </button>
        </form>
        <p className="chat-pie">
          <span className={`punto-escucha ${a.escuchaActiva ? 'activa' : ''}`} aria-hidden />
          {a.escuchaActiva ? t('Escuchando «Higia»') : t('Escucha por voz apagada')}
          <span aria-hidden>·</span>
          {t('Preguntas: {frecuencia}', { frecuencia: t(nombreProactivo).toLowerCase() })}
          <button type="button" className="boton-enlace" onClick={() => setVerAjustes((v) => !v)} aria-controls="ajustes-higia" aria-expanded={verAjustes}>
            {verAjustes ? t('Cerrar ajustes') : t('Cambiar')}
          </button>
        </p>
      </section>
    </div>
  );
}
