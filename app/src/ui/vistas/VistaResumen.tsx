import { redactar } from '../../core/personalizador';
import { antecedentesDe, NOMBRE_SISTEMA, ORDEN_NIVEL, SISTEMAS, type Contexto, type EstadoCorporal, type Hallazgo, type Nivel, type Perfil, type RegionCuerpo, type SistemaCorporal } from '../../core/tipos';
import { EncabezadoSeccion, InsigniaNivel, NOMBRE_NIVEL, Punto, sinTitulo } from '../componentes/basicos';
import { FiguraCorporal } from '../FiguraCorporal';
import { Icono } from '../iconos';

interface Props {
  perfil: Perfil;
  contexto: Contexto;
  estado: EstadoCorporal;
  regiones: Partial<Record<RegionCuerpo, Nivel>>;
  hallazgos: Hallazgo[];
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (s: SistemaCorporal[] | null) => void;
  onIrMensajes: () => void;
}

export function VistaResumen({ perfil, contexto, estado, regiones, hallazgos, seleccion, onSeleccionar, onIrMensajes }: Props) {
  const atencion = hallazgos
    .filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso)
    .sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel]);
  const conDatos = SISTEMAS.filter((s) => estado[s] !== 'sinDatos').length;
  const seleccionado = (s: SistemaCorporal) => !!seleccion?.includes(s);

  return (
    <>
      <EncabezadoSeccion titulo="Resumen" descripcion={`Estado de salud de ${perfil.nombre}`} />
      <div className="resumen">
        <section className="tarjeta tarjeta-figura" aria-labelledby="titulo-cuerpo">
          <h2 id="titulo-cuerpo" className="titulo-tarjeta">Cuerpo</h2>
          <FiguraCorporal estado={estado} regiones={regiones} seleccion={seleccion} onSeleccionar={onSeleccionar} />
        </section>

        <div className="resumen-lateral">
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
