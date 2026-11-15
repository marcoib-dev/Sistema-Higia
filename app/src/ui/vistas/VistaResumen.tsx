import { ID_SENALES_COMBINADAS, senalesQueSeSuman, type AptitudTareas } from '../../core/nucleo';
import { redactar } from '../../core/personalizador';
import { RIESGO_HRP } from '../../core/riesgosHRP';
import { antecedentesDe, NOMBRE_DESTINO, NOMBRE_SISTEMA, NOMBRE_TAREA, ORDEN_NIVEL, SISTEMAS, TAREAS_CRITICAS, type Contexto, type EstadoCorporal, type Hallazgo, type Nivel, type Perfil, type RegionCuerpo, type SistemaCorporal } from '../../core/tipos';
import { EncabezadoSeccion, InsigniaNivel, NOMBRE_NIVEL, Punto, sinTitulo } from '../componentes/basicos';
import { FiguraCorporal } from '../FiguraCorporal';
import { Icono } from '../iconos';

interface Props {
  perfil: Perfil;
  contexto: Contexto;
  estado: EstadoCorporal;
  regiones: Partial<Record<RegionCuerpo, Nivel>>;
  hallazgos: Hallazgo[];
  aptitud: AptitudTareas;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (s: SistemaCorporal[] | null) => void;
  onIrMensajes: () => void;
}

export function VistaResumen({ perfil, contexto, estado, regiones, hallazgos, aptitud, seleccion, onSeleccionar, onIrMensajes }: Props) {
  const combinada = hallazgos.find((h) => h.riesgoId === ID_SENALES_COMBINADAS);
  const senales = combinada ? senalesQueSeSuman(hallazgos) : [];
  const bloqueadas = TAREAS_CRITICAS.filter((t) => !aptitud[t].apto);
  const atencion = hallazgos
    // La combinación tiene su propia tarjeta: no se repite en la lista.
    .filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso && h.riesgoId !== ID_SENALES_COMBINADAS)
    .sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel]);
  const conDatos = SISTEMAS.filter((s) => estado[s] !== 'sinDatos').length;
  const seleccionado = (s: SistemaCorporal) => !!seleccion?.includes(s);

  return (
    <>
      <EncabezadoSeccion
        titulo="Resumen" descripcion={`Estado de salud de ${perfil.nombre}`}
        acciones={(
          <p className="dia-mision" aria-label={`Día ${contexto.diaMision} de misión, ${NOMBRE_DESTINO[contexto.destino]}`}>
            <span className="dia-mision-n">Día {contexto.diaMision}</span>
            <span className="dia-mision-texto">de misión · {NOMBRE_DESTINO[contexto.destino]}{contexto.transicionGravedad ? ' · transición de gravedad' : ''}</span>
          </p>
        )}
      />
      <div className="resumen">
        <section className="tarjeta tarjeta-figura" aria-labelledby="titulo-cuerpo">
          <h2 id="titulo-cuerpo" className="titulo-tarjeta">Cuerpo</h2>
          <FiguraCorporal estado={estado} regiones={regiones} seleccion={seleccion} onSeleccionar={onSeleccionar} />
        </section>

        <div className="resumen-lateral">
          {combinada && (
            <section className="tarjeta tarjeta-senales" aria-labelledby="titulo-senales">
              <div className="tarjeta-cab">
                <h2 id="titulo-senales" className="titulo-tarjeta">Señales que se suman</h2>
                <InsigniaNivel nivel={combinada.nivel} />
              </div>
              <p className="senales-intro">Ninguna es grave por sí sola. Juntas, hoy dejan menos margen.</p>
              <ol className="lista-senales">
                {senales.map((h, i) => (
                  <li key={h.riesgoId} style={{ '--i': i } as React.CSSProperties}>
                    <button onClick={() => onSeleccionar([h.sistema])}>
                      <Punto nivel={h.nivel} />
                      <span className="senal-titulo">{h.titulo}</span>
                      <span className="senal-meta">{NOMBRE_SISTEMA[h.sistema]}{h.hrp?.[0] ? ` · ${RIESGO_HRP[h.hrp[0]].nombre}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="senales-conclusion" style={{ '--i': senales.length } as React.CSSProperties}>
                <Icono nombre="escudo" tamano={18} />
                <span><strong>{combinada.accion.split('. ')[0]}.</strong> {combinada.accion.split('. ').slice(1).join('. ')}</span>
              </p>
            </section>
          )}

          <section className="tarjeta" aria-labelledby="titulo-atencion">
            <div className="tarjeta-cab">
              <h2 id="titulo-atencion" className="titulo-tarjeta">Requiere atención</h2>
              {atencion.length > 0 && <button className="boton-enlace" onClick={onIrMensajes}>Ver mensajes <Icono nombre="flecha" tamano={14} /></button>}
            </div>
            {atencion.length === 0 ? (
              <div className="todo-en-orden">
                <span className="todo-en-orden-icono"><Icono nombre="check" tamano={20} /></span>
                <div>
                  <strong>Todo en orden</strong>
                  <p>{conDatos ? 'No hay avisos ni alertas activas.' : 'Todavía no llegan datos de los sensores.'}</p>
                </div>
              </div>
            ) : (
              <ul className="lista-atencion">
                {atencion.map((h) => (
                  <li key={h.riesgoId} className={`nivel-borde-${h.nivel}`}>
                    <button onClick={() => onSeleccionar([h.sistema])}>
                      <span className="atencion-cab"><InsigniaNivel nivel={h.nivel} /><strong>{h.titulo}</strong></span>
                      <span className="atencion-texto">{sinTitulo(redactar(h, perfil, contexto), h.titulo)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {bloqueadas.length > 0 && (
            <section className="tarjeta tarjeta-aptitud" aria-labelledby="titulo-aptitud">
              <h2 id="titulo-aptitud" className="titulo-tarjeta">Aptitud para tareas</h2>
              <ul className="semaforo-tareas">
                {TAREAS_CRITICAS.map((t) => {
                  const { apto, motivos } = aptitud[t];
                  return (
                    <li key={t} className={apto ? 'apto' : 'no-apto'}>
                      <Icono nombre={apto ? 'check' : 'alerta'} tamano={16} />
                      <span>
                        <strong>{NOMBRE_TAREA[t]}</strong>
                        <small>{apto ? 'Sin contraindicaciones' : `Hoy no se recomienda · ${motivos.map((m) => m.titulo).join(' · ')}`}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="tarjeta" aria-labelledby="titulo-sistemas">
            <div className="tarjeta-cab">
              <h2 id="titulo-sistemas" className="titulo-tarjeta">Sistemas del cuerpo</h2>
              <span className="texto-suave">{conDatos} de {SISTEMAS.length} con datos</span>
            </div>
            <ul className="lista-sistemas">
              {SISTEMAS.map((s) => {
                const propios = hallazgos.filter((h) => h.sistema === s);
                const abierto = seleccionado(s);
                return (
                  <li key={s}>
                    <button aria-expanded={abierto} onClick={() => onSeleccionar(abierto ? null : [s])}>
                      <Punto nivel={estado[s]} />
                      <span className="sistema-nombre">{NOMBRE_SISTEMA[s]}</span>
                      <span className="sistema-estado">{NOMBRE_NIVEL[estado[s]]}</span>
                      <Icono nombre="flecha" tamano={14} />
                    </button>
                    {abierto && (
                      <div className="sistema-detalle">
                        {propios.length
                          ? propios.map((h) => <p key={h.riesgoId}><strong>{h.titulo}.</strong> {sinTitulo(redactar(h, perfil, contexto), h.titulo)}</p>)
                          : <p className="texto-suave">Sin sensores que reporten sobre este sistema todavía.</p>}
                        {antecedentesDe(perfil.historiaClinica, s).map((a) => (
                          <p key={a.nombre} className="mensaje-antecedente"><Icono nombre="documento" tamano={14} /> Antecedente: {a.nombre}{a.detalle ? ` (${a.detalle})` : ''}</p>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
