import type { Observacion } from '../../adaptadores/interop/ejemploNasa';
import type { Mensaje } from '../../core/tipos';
import { EncabezadoSeccion, Etiqueta, InsigniaNivel, Vacio } from '../componentes/basicos';
import { Icono } from '../iconos';

interface Props {
  conectado: boolean;
  pendientes: number;
  enviados: Observacion[];
  escaladas: Mensaje[];
}

const hora = (ts: number | string) => new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function VistaReportes({ conectado, pendientes, enviados, escaladas }: Props) {
  return (
    <>
      <EncabezadoSeccion titulo="Reportes" descripcion="A quién avisó Higia y qué se envió a los sistemas médicos." />

      <div className="reportes">
        <section className="tarjeta" aria-labelledby="titulo-escaladas">
          <h2 id="titulo-escaladas" className="titulo-tarjeta">Escaladas por falta de respuesta</h2>
          {escaladas.length === 0 ? (
            <Vacio icono="escalado" titulo="Sin escaladas">Cuando una alerta no recibe "Estoy bien" a tiempo, aquí queda registro de a quién se avisó.</Vacio>
          ) : (
            <ul className="lista-registro">
              {escaladas.map((m) => (
                <li key={m.id}>
                  <time>{hora(m.timestamp)}</time>
                  <div>
                    <strong>{m.hallazgo.titulo}</strong>
                    <p>{m.escalamiento!.destinos.join(', ')}</p>
                    <p className="texto-suave">{m.escalamiento!.motivo}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tarjeta" aria-labelledby="titulo-interop">
          <div className="tarjeta-cab">
            <h2 id="titulo-interop" className="titulo-tarjeta">Sistemas médicos</h2>
            <Etiqueta icono="info">Interfaz de ejemplo</Etiqueta>
          </div>
          <div className="estado-enlace">
            <div className={`estado-enlace-icono ${conectado ? 'ok' : ''}`}><Icono nombre={conectado ? 'conexion' : 'sinConexion'} tamano={22} /></div>
            <div>
              <strong>{conectado ? 'Conectado al hábitat' : 'Sin conexión: modo autónomo'}</strong>
              <p className="texto-suave">{pendientes} en cola · {enviados.length} enviados</p>
            </div>
          </div>
          <p className="nota">No es una API real de la NASA. Muestra cómo Higia exporta hallazgos en formato HL7 FHIR, enviando el identificador del astronauta y no su nombre.</p>

          {enviados.length > 0 && (
            <ul className="lista-registro">
              {[...enviados].reverse().map((o, i) => (
                <li key={i}>
                  <time>{hora(o.effectiveDateTime)}</time>
                  <div>
                    <span className="registro-cab"><InsigniaNivel nivel={o.interpretation[0].text as never} /><strong>{o.code.text}</strong></span>
                    <p className="texto-suave">{o.valueString} · {o.subject.reference}</p>
                    <details>
                      <summary><Icono nombre="documento" tamano={14} /> Ver registro FHIR</summary>
                      <pre>{JSON.stringify(o, null, 2)}</pre>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
