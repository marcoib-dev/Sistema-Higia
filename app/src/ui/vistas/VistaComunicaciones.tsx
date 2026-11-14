/**
 * COMUNICACIONES — todo lo que Higia envió a otras personas: avisos automáticos cuando una alerta
 * no recibe respuesta, pedidos de ayuda y mensajes que el astronauta le pidió al asistente.
 */
import type { Comunicacion } from '../../core/tipos';
import { EncabezadoSeccion, Etiqueta, Vacio } from '../componentes/basicos';
import { Icono } from '../iconos';

interface Props {
  comunicaciones: Comunicacion[];
  destinos: string[];
  onPedirAyuda: () => void;
}

const hora = (ts: number) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const ESTADO: Record<Comunicacion['estado'], string> = { enviado: 'Enviado', enCola: 'En cola: sale al reconectar', respondido: 'Respondió' };

export function VistaComunicaciones({ comunicaciones, destinos, onPedirAyuda }: Props) {
  return (
    <>
      <EncabezadoSeccion
        titulo="Comunicaciones"
        descripcion="A quién avisó Higia y qué respondieron. Para enviar algo, díselo: «Higia, dile a Tierra que…»."
        acciones={<button className="boton boton-peligro" onClick={onPedirAyuda}><Icono nombre="alerta" /> Pedir ayuda</button>}
      />

      <section className="tarjeta alcance" aria-labelledby="titulo-alcance">
        <h2 id="titulo-alcance" className="titulo-tarjeta">Al alcance ahora</h2>
        {destinos.length ? (
          <ul className="lista-alcance">{destinos.map((d) => <li key={d}><Icono nombre="conexion" tamano={16} /> {d}</li>)}</ul>
        ) : (
          <p className="texto-suave">Nadie al alcance: en una emergencia Higia activa la baliza y reintenta al recuperar enlace.</p>
        )}
        <p className="nota">Si una alerta no recibe «Estoy bien» a tiempo, Higia avisa primero por voz y luego se comunica con ellos, enviando qué pasó, dónde estás, tus datos actuales y tu historia clínica (alergias, antecedentes, medicación).</p>
      </section>

      {comunicaciones.length === 0 ? (
        <Vacio icono="escalado" titulo="Sin comunicaciones todavía">
          Prueba «Higia, dile a mi compañero que voy para allá» o ejecuta el escenario «Crisis sin respuesta» en la demo.
        </Vacio>
      ) : (
        <ol className="lista-comunicaciones">
          {comunicaciones.map((c) => (
            <li key={c.id} className={`comunicacion tipo-${c.tipo} estado-${c.estado}`}>
              <div className="mensaje-cab">
                {c.tipo === 'emergencia' ? <Etiqueta icono="alerta" tono="alerta">Emergencia</Etiqueta> : <Etiqueta icono="mensajes">Mensaje</Etiqueta>}
                <h3>{c.destinatario}</h3>
                <time dateTime={new Date(c.timestamp).toISOString()}>{hora(c.timestamp)}</time>
              </div>
              <p className="com-asunto">{c.asunto}</p>
              <div className="mensaje-etiquetas">
                <Etiqueta icono={c.origen === 'escalada' ? 'escalado' : 'asistente'}>{c.origen === 'escalada' ? 'Automático: alerta sin respuesta' : 'Pedido al asistente'}</Etiqueta>
                <Etiqueta icono={c.estado === 'enCola' ? 'sinConexion' : c.estado === 'respondido' ? 'check' : 'enviar'}>{ESTADO[c.estado]}</Etiqueta>
                {c.retardo && <Etiqueta icono="reloj">Retardo {c.retardo}</Etiqueta>}
              </div>
              {c.respuesta && (
                <p className="com-respuesta"><Icono nombre="asistente" tamano={16} /> {c.respuesta.texto} <span className="texto-suave">· {hora(c.respuesta.timestamp)}</span></p>
              )}
              <details className="mensaje-detalles">
                <summary>Mensaje enviado</summary>
                <p className="com-texto">{c.texto}</p>
              </details>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
