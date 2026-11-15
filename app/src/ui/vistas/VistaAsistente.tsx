/**
 * HIGIA — la sección de inicio. El asistente es la base de la app: desde aquí (o diciendo «Higia»
 * en cualquier momento) se consulta el estado, se piden cosas, se avisa a otros y se navega.
 */
import { useEffect, useRef, useState } from 'react';
import type { Comunicacion, Hallazgo, Perfil } from '../../core/tipos';
import { ORDEN_NIVEL } from '../../core/tipos';
import { TEXTO_ESCUCHA, type Asistente } from '../asistente';
import { EncabezadoSeccion, Etiqueta, Interruptor } from '../componentes/basicos';
import { Icono } from '../iconos';
import type { Seccion } from '../navegacion';

interface Props {
  asistente: Asistente;
  iaActiva: boolean;
  perfil: Perfil;
  hallazgos: Hallazgo[];
  alertasPendientes: number;
  comunicaciones: Comunicacion[];
  onIr: (s: Seccion) => void;
  onPedirAyuda: () => void;
}

const SUGERENCIAS = [
  '¿Cómo estoy?',
  'Anoche dormí como cinco horas y me siento cansado',
  'Dile a Tierra que terminé la reparación',
  'Me duele la cabeza',
  'Abre mi historia clínica',
  'Pide ayuda',
];

export function VistaAsistente({ asistente: a, iaActiva, perfil, hallazgos, alertasPendientes, comunicaciones, onIr, onPedirAyuda }: Props) {
  const [texto, setTexto] = useState('');
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [a.historial.length, a.pensando]);

  const enviar = (f: string) => { void a.enviar(f); setTexto(''); };

  // El historial llega del más nuevo al más viejo; en un chat se lee de arriba hacia abajo.
  const cronologico = [...a.historial].reverse();
  const atencion = hallazgos.filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso);
  const ultimaCom = comunicaciones[0];
  const estadoEscucha = a.dictando ? 'Escuchando tu frase…' : TEXTO_ESCUCHA[a.estadoEscucha];

  return (
    <div className="asistente">
      <EncabezadoSeccion
        titulo="Higia"
        descripcion={`Hola, ${perfil.nombre.split(' ')[0]}. Di «Higia» y lo que necesitas, o escríbelo. Puedo consultar tu estado, avisar a otros y manejar la app por ti.`}
        acciones={(
          <>
            {a.motorVoz === 'local' && <Etiqueta icono="microfono" tono="ia">Voz local</Etiqueta>}
            {iaActiva ? <Etiqueta icono="ia" tono="ia">IA activa</Etiqueta> : <Etiqueta icono="sinConexion">Modo local</Etiqueta>}
            <button className="boton boton-peligro" onClick={onPedirAyuda}><Icono nombre="alerta" /> Pedir ayuda</button>
          </>
        )}
      />

      <div className="estado-rapido">
        <button className={atencion.length ? 'con-aviso' : ''} onClick={() => onIr('resumen')}>
          <Icono nombre="resumen" tamano={20} />
          <span><strong>{atencion.length ? `${atencion.length} punto${atencion.length > 1 ? 's' : ''} a atender` : 'Todo en orden'}</strong><small>Estado de salud</small></span>
        </button>
        <button className={alertasPendientes ? 'con-alerta' : ''} onClick={() => onIr('mensajes')}>
          <Icono nombre="alerta" tamano={20} />
          <span><strong>{alertasPendientes ? `${alertasPendientes} esperando respuesta` : 'Sin alertas'}</strong><small>Alertas</small></span>
        </button>
        <button onClick={() => onIr('comunicaciones')}>
          <Icono nombre="escalado" tamano={20} />
          <span>
            <strong>{ultimaCom ? ultimaCom.destinatario.replace(/ \(.*\)$/, '') : 'Sin comunicaciones'}</strong>
            <small>{ultimaCom ? (ultimaCom.respuesta ? 'Respondió' : ultimaCom.estado === 'enCola' ? 'En cola' : 'Enviado') : 'Comunicaciones'}</small>
          </span>
        </button>
      </div>

      <section className="tarjeta chat" aria-label="Conversación con Higia">
        <div className={`escucha-estado ${a.estadoEscucha} ${a.dictando ? 'dictando' : ''}`} aria-live="polite">
          <span className="escucha-punto" aria-hidden />
          {estadoEscucha}
          {a.detalleEscucha && !a.problemaVoz && <span className="texto-suave"> · {a.detalleEscucha}</span>}
        </div>
        {a.problemaVoz && (
          <p className="aviso-voz" role="status">
            <Icono nombre="alerta" tamano={14} /> {a.problemaVoz}
          </p>
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
              <div className="burbuja burbuja-higia">
                <span className="burbuja-autor">{i.fuente === 'ia' ? 'Higia · IA' : 'Higia · local'}</span>
                <p>{i.respuesta}</p>
                {i.hechos.length > 0 && (
                  <ul className="hechos" aria-label="Lo que hizo Higia">
                    {i.hechos.map((h) => <li key={h}><Icono nombre="check" tamano={14} /> {h}</li>)}
                  </ul>
                )}
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
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={a.dictando ? 'Escuchando…' : 'Escríbele a Higia'} aria-label="Mensaje para Higia" />
          <button type="submit" className="boton boton-primario" disabled={a.pensando || !texto.trim()} aria-label="Enviar">
            <Icono nombre="enviar" /> <span className="ocultar-movil">Enviar</span>
          </button>
        </form>
        <div className="chat-opciones">
          <Interruptor
            etiqueta="Escuchar «Higia»"
            descripcion="Higia solo se activa cuando la nombras: «Higia, pide ayuda», «Higia, ¿cómo estoy?»"
            activo={a.escuchaActiva} onCambio={a.alternarEscucha}
          />
        </div>
      </section>
    </div>
  );
}
