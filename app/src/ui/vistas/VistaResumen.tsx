import type { Historial } from '../../core/historial';
import { ID_SENALES_COMBINADAS, senalesQueSeSuman, type AptitudTareas } from '../../core/nucleo';
import { redactar } from '../../core/personalizador';
import { RIESGO_HRP } from '../../core/riesgosHRP';
import { antecedentesDe, NOMBRE_DESTINO, NOMBRE_SISTEMA, NOMBRE_TAREA, ORDEN_NIVEL, SISTEMAS, TAREAS_CRITICAS, type Contexto, type TareaCritica, type EstadoCorporal, type Hallazgo, type Nivel, type Perfil, type RegionCuerpo, type SistemaCorporal } from '../../core/tipos';
import { EncabezadoSeccion, InsigniaNivel, NOMBRE_NIVEL, Punto, sinTitulo } from '../componentes/basicos';
import { FiguraCorporal } from '../FiguraCorporal';
import { Icono } from '../iconos';
import { useT } from '../idioma';

/** Si el astronauta está haciendo la tarea ahora mismo, según el contexto. */
const TAREA_EN_CURSO: Record<TareaCritica, (c: Contexto) => boolean> = {
  eva: (c) => c.ubicacion === 'eva',
  pilotaje: (c) => c.ubicacion === 'rover',
  ejercicioIntenso: (c) => c.actividad === 'ejercicio',
};
/** Qué hacer ya cuando una alerta contraindica la tarea en curso. */
const DETENER_TAREA: Record<TareaCritica, string> = {
  eva: 'Vuelve a la nave ya',
  pilotaje: 'Detén el vehículo de forma segura',
  ejercicioIntenso: 'Detén el ejercicio ahora',
};

interface Props {
  perfil: Perfil;
  contexto: Contexto;
  estado: EstadoCorporal;
  regiones: Partial<Record<RegionCuerpo, Nivel>>;
  hallazgos: Hallazgo[];
  /** Lecturas de sensores: alimentan las métricas de los sistemas que no se ven en la figura (inmune). */
  historial?: Historial;
  aptitud: AptitudTareas;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (s: SistemaCorporal[] | null) => void;
  onIrMensajes: () => void;
}

export function VistaResumen({ perfil, contexto, estado, regiones, hallazgos, historial, aptitud, seleccion, onSeleccionar, onIrMensajes }: Props) {
  const t = useT();
  const combinada = hallazgos.find((h) => h.riesgoId === ID_SENALES_COMBINADAS);
  const senales = combinada ? senalesQueSeSuman(hallazgos) : [];
  const bloqueadas = TAREAS_CRITICAS.filter((t) => !aptitud[t].apto);
  const atencion = hallazgos
    // La combinación tiene su propia tarjeta: no se repite en la lista.
    .filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso && h.riesgoId !== ID_SENALES_COMBINADAS)
    .sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel]);
  const conDatos = SISTEMAS.filter((s) => estado[s] !== 'sinDatos').length;
  // Sin sensores todavía, los hallazgos sin aviso (p. ej. la pérdida ósea estimada) se nombran para no
  // contradecir al chat. Con datos, la lista de sistemas ya los muestra uno por uno.
  const seguimiento = conDatos ? [] : hallazgos.filter((h) => ORDEN_NIVEL[h.nivel] < ORDEN_NIVEL.aviso && h.riesgoId !== ID_SENALES_COMBINADAS);
  const esperandoDatos = !conDatos && !seguimiento.length;
  const seleccionado = (s: SistemaCorporal) => !!seleccion?.includes(s);

  return (
    <>
      <EncabezadoSeccion
        titulo={t('Resumen')} descripcion={t('Estado de salud de {nombre}', { nombre: perfil.nombre })}
        acciones={(
          <p className="dia-mision" aria-label={`${t('Día {n} de misión', { n: contexto.diaMision })}, ${t(NOMBRE_DESTINO[contexto.destino])}`}>
            <span className="dia-mision-n">{t('Día {n}', { n: contexto.diaMision })}</span>
            <span className="dia-mision-texto">{t('de misión')} · {t(NOMBRE_DESTINO[contexto.destino])}{contexto.transicionGravedad ? ` · ${t('transición de gravedad')}` : ''}</span>
          </p>
        )}
      />
      <div className="resumen">
        <section className="tarjeta tarjeta-figura" aria-labelledby="titulo-cuerpo">
          <h2 id="titulo-cuerpo" className="titulo-tarjeta">{t('Cuerpo')}</h2>
          <FiguraCorporal estado={estado} regiones={regiones} historial={historial} hallazgos={hallazgos} seleccion={seleccion} onSeleccionar={onSeleccionar} />
        </section>

        <div className="resumen-lateral">
          {combinada && (
            <section className="tarjeta tarjeta-senales" aria-labelledby="titulo-senales">
              <div className="tarjeta-cab">
                <h2 id="titulo-senales" className="titulo-tarjeta">{t('Señales que se suman')}</h2>
                <InsigniaNivel nivel={combinada.nivel} />
              </div>
              <p className="senales-intro">{t('Ninguna es grave por sí sola. Juntas, hoy dejan menos margen.')}</p>
              <ol className="lista-senales">
                {senales.map((h, i) => (
                  <li key={h.riesgoId} style={{ '--i': i } as React.CSSProperties}>
                    <button onClick={() => onSeleccionar([h.sistema])}>
                      <Punto nivel={h.nivel} />
                      <span className="senal-titulo">{t(h.titulo)}</span>
                      <span className="senal-meta">{t(NOMBRE_SISTEMA[h.sistema])}{h.hrp?.[0] ? ` · ${t(RIESGO_HRP[h.hrp[0]].nombre)}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="senales-conclusion" style={{ '--i': senales.length } as React.CSSProperties}>
                <Icono nombre="escudo" tamano={18} />
                <span>{t(combinada.accion)}</span>
              </p>
            </section>
          )}

          <section className="tarjeta" aria-labelledby="titulo-atencion">
            <div className="tarjeta-cab">
              <h2 id="titulo-atencion" className="titulo-tarjeta">{t('Requiere atención')}</h2>
              {atencion.length > 0 && <button className="boton-enlace" onClick={onIrMensajes}>{t('Ver mensajes')} <Icono nombre="flecha" tamano={14} /></button>}
            </div>
            {atencion.length === 0 ? (
              <div className={`todo-en-orden ${esperandoDatos ? 'esperando-datos' : ''}`}>
                <span className="todo-en-orden-icono"><Icono nombre={esperandoDatos ? 'reloj' : 'check'} tamano={20} /></span>
                <div>
                  <strong>{esperandoDatos ? t('Esperando datos') : t('Todo en orden')}</strong>
                  <p>{esperandoDatos ? t('Todavía no llegan datos de los sensores.') : t('No hay avisos ni alertas activas.')}</p>
                  {seguimiento.length > 0 && (
                    <p className="en-seguimiento">{t('En seguimiento')}: {seguimiento.map((h) => t(h.titulo)).join(' · ')}</p>
                  )}
                </div>
              </div>
            ) : (
              <ul className="lista-atencion">
                {atencion.map((h) => (
                  <li key={h.riesgoId} className={`nivel-borde-${h.nivel}`}>
                    <button onClick={() => onSeleccionar([h.sistema])}>
                      <span className="atencion-cab"><InsigniaNivel nivel={h.nivel} /><strong>{t(h.titulo)}</strong></span>
                      <span className="atencion-texto">{sinTitulo(redactar(h, perfil, contexto), h.titulo)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {bloqueadas.length > 0 && (
            <section className="tarjeta tarjeta-aptitud" aria-labelledby="titulo-aptitud">
              <h2 id="titulo-aptitud" className="titulo-tarjeta">{t('Aptitud para tareas')}</h2>
              <ul className="semaforo-tareas">
                {TAREAS_CRITICAS.map((tarea) => {
                  const { apto, motivos } = aptitud[tarea];
                  // Con una alerta (no un aviso) el semáforo pasa a rojo; si además la tarea está en curso,
                  // dice qué hacer ya en vez de "hoy no se recomienda".
                  const grave = motivos.some((m) => m.nivel === 'alerta');
                  const enCurso = TAREA_EN_CURSO[tarea](contexto);
                  const veredicto = apto ? t('Sin contraindicaciones')
                    : grave && enCurso ? t(DETENER_TAREA[tarea])
                    : grave ? t('No apto hoy')
                    : t('Hoy no se recomienda');
                  return (
                    <li key={tarea} className={apto ? 'apto' : grave ? 'no-apto grave' : 'no-apto'}>
                      <Icono nombre={apto ? 'check' : 'alerta'} tamano={16} />
                      <span>
                        <strong>{t(NOMBRE_TAREA[tarea])}{!apto && enCurso ? <span className="tarea-en-curso"> · {t('en curso')}</span> : null}</strong>
                        <small>{apto ? veredicto : `${veredicto} · ${motivos.map((m) => t(m.titulo)).join(' · ')}`}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="tarjeta" aria-labelledby="titulo-sistemas">
            <div className="tarjeta-cab">
              <h2 id="titulo-sistemas" className="titulo-tarjeta">{t('Sistemas del cuerpo')}</h2>
              <span className="texto-suave">{t('{n} de {total} con datos', { n: conDatos, total: SISTEMAS.length })}</span>
            </div>
            <ul className="lista-sistemas">
              {SISTEMAS.map((s) => {
                const propios = hallazgos.filter((h) => h.sistema === s);
                const abierto = seleccionado(s);
                return (
                  <li key={s}>
                    <button aria-expanded={abierto} onClick={() => onSeleccionar(abierto ? null : [s])}>
                      <Punto nivel={estado[s]} />
                      <span className="sistema-nombre">{t(NOMBRE_SISTEMA[s])}</span>
                      <span className="sistema-estado">{t(NOMBRE_NIVEL[estado[s]])}</span>
                      <Icono nombre="flecha" tamano={14} />
                    </button>
                    {abierto && (
                      <div className="sistema-detalle">
                        {propios.length
                          ? propios.map((h) => <p key={h.riesgoId}><strong>{t(h.titulo)}.</strong> {sinTitulo(redactar(h, perfil, contexto), h.titulo)}</p>)
                          : <p className="texto-suave">{t('Sin sensores que reporten sobre este sistema todavía.')}</p>}
                        {antecedentesDe(perfil.historiaClinica, s).map((a) => (
                          <p key={a.nombre} className="mensaje-antecedente"><Icono nombre="documento" tamano={14} /> {t('Antecedente')}: {t(a.nombre)}{a.detalle ? ` (${t(a.detalle)})` : ''}</p>
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
