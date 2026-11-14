import { useCallback, useEffect, useRef, useState } from 'react';
import { analizarEntornoIA, consultarEstadoIA, conversarIA, estadoParaIA } from '../adaptadores/ia/cliente';
import type { EstadoIA, RespuestaConversacion, TurnoConversacion } from '../adaptadores/ia/contrato';
import { AdaptadorEjemplo } from '../adaptadores/interop/ejemploNasa';
import type { Escenario } from '../adaptadores/simulador/escenarios';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { hablar } from '../adaptadores/voz/voz';
import { interpretar } from '../core/conversacion';
import { NucleoSalud } from '../core/nucleo';
import { redactar } from '../core/personalizador';
import { REGLAS } from '../core/reglas';
import { NOMBRE_DESTINO, NOMBRE_SISTEMA, ORDEN_NIVEL, type Contexto, type Lectura, type Mensaje, type SistemaCorporal } from '../core/tipos';
import { ControlVoz } from './ControlVoz';
import { COLOR_NIVEL, FiguraCorporal, NOMBRE_NIVEL } from './FiguraCorporal';
import { FiguraCorporal3D, webglDisponible } from './FiguraCorporal3D';
import { PanelCamara } from './PanelCamara';
import { PanelComparacion } from './PanelComparacion';
import { PanelControl, PanelEscenarios } from './PanelControl';
import { PanelConversacion, type Intercambio, type ResultadoConversacion } from './PanelConversacion';
import { PanelInterop } from './PanelInterop';
import { PanelMensajes } from './PanelMensajes';

const CONTEXTO_INICIAL: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: true, medicoABordo: false,
  conexionHabitat: false, conexionTierra: false,
};

const CLAVE_SIMULADOR = 'higia.mostrarSimulador';
const leerPreferencia = () => {
  try { return localStorage.getItem(CLAVE_SIMULADOR) !== 'no'; } catch { return true; }
};
const guardarPreferencia = (v: boolean) => {
  try { localStorage.setItem(CLAVE_SIMULADOR, v ? 'si' : 'no'); } catch { /* sin almacenamiento: no pasa nada */ }
};

export function App() {
  const [nucleo] = useState(() => new NucleoSalud(REGLAS, PERFILES[0], CONTEXTO_INICIAL));
  const [interop] = useState(() => new AdaptadorEjemplo());
  const [figura3D] = useState(webglDisponible);
  const [, setVersion] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [chat, setChat] = useState<Intercambio[]>([]);
  const [seleccion, setSeleccion] = useState<SistemaCorporal[] | null>(null);
  const [vozActiva, setVozActiva] = useState(true);
  const [mostrarSimulador, setMostrarSimulador] = useState(leerPreferencia);
  const [ia, setIa] = useState<EstadoIA>({ configurada: false, modelo: '' });
  const turnos = useRef<TurnoConversacion[]>([]);
  const vozRef = useRef(vozActiva);
  vozRef.current = vozActiva;

  const refrescar = () => setVersion((v) => v + 1);
  const iaActiva = nucleo.contexto.conexionHabitat && ia.configurada;

  useEffect(() => { void consultarEstadoIA().then(setIa); }, []);

  const procesar = useCallback(async (nuevos: Mensaje[]) => {
    if (vozRef.current) nuevos.filter((m) => m.voz).forEach((m) => hablar(m.texto));
    if (nuevos.length) setMensajes((prev) => [...nuevos, ...prev].slice(0, 100));
    // La capa de interoperabilidad solo actúa con conexión; si no, el núcleo sigue solo.
    if (nucleo.contexto.conexionHabitat && nucleo.hayPendientesReporte()) {
      await interop.enviar(nucleo.tomarPendientesReporte(), nucleo.perfil);
    }
    refrescar();
  }, [nucleo, interop]);

  // Cada segundo: confirmaciones vencidas (escalada). Cada minuto: recordatorios.
  useEffect(() => {
    let segundos = 0;
    const id = setInterval(() => {
      const t = Date.now();
      setAhora(t);
      const nuevos = nucleo.verificarConfirmaciones(t);
      if (++segundos % 60 === 0) nuevos.push(...nucleo.tick(t));
      if (nuevos.length) void procesar(nuevos);
    }, 1000);
    return () => clearInterval(id);
  }, [nucleo, procesar]);

  const cambiarContexto = (c: Partial<Contexto>) => void procesar(nucleo.actualizarContexto(c));

  const ejecutarEscenario = (e: Escenario) => {
    const deContexto = e.contexto ? nucleo.actualizarContexto(e.contexto) : [];
    const t = Date.now();
    void procesar([...deContexto, ...nucleo.registrar(e.lecturas(t, nucleo.historial), t)]);
  };

  const cambiarPerfil = (id: string) => {
    nucleo.cambiarPerfil(PERFILES.find((p) => p.id === id)!);
    refrescar();
  };

  const confirmar = (id: string) => {
    nucleo.confirmar(id);
    refrescar();
  };

  const alternarSimulador = (v: boolean) => {
    setMostrarSimulador(v);
    guardarPreferencia(v);
  };

  /** Convierte lo que la IA extrajo de la conversación en lecturas del núcleo. */
  const lecturasDesdeIA = (r: RespuestaConversacion): Lectura[] => {
    const t = Date.now();
    return r.lecturas.map(({ sensor, valor }) => {
      if (sensor !== 'minutosEjercicioRealizados') return { sensor, valor, timestamp: t, fuente: 'voz' as const };
      const previo = nucleo.historial.ultima('minutosEjercicio');
      const mismoDia = previo && new Date(previo.timestamp).toDateString() === new Date(t).toDateString();
      return { sensor: 'minutosEjercicio' as const, valor: (mismoDia ? previo.valor : 0) + valor, timestamp: t, fuente: 'voz' as const };
    });
  };

  const conversar = async (frase: string): Promise<ResultadoConversacion> => {
    let resultado: ResultadoConversacion;
    let lecturas: Lectura[];
    try {
      if (!iaActiva) throw new Error('');
      const r = await conversarIA({ frase, historial: turnos.current, estado: estadoParaIA(nucleo) });
      lecturas = lecturasDesdeIA(r);
      resultado = { texto: r.respuesta, fuente: 'ia' };
    } catch (e) {
      // Autonomía primero: sin IA, responde el intérprete local.
      const local = interpretar(frase, nucleo);
      lecturas = local.lecturas;
      const motivo = e instanceof Error && e.message ? `IA no disponible (${e.message}). ` : '';
      resultado = { texto: local.texto, fuente: 'local', nota: motivo ? `${motivo}Respondió el intérprete local.` : undefined };
    }
    turnos.current = [...turnos.current, { rol: 'astronauta' as const, texto: frase }, { rol: 'higia' as const, texto: resultado.texto }].slice(-12);
    setChat((prev) => [{ id: Date.now(), pregunta: frase, respuesta: resultado.texto, fuente: resultado.fuente, nota: resultado.nota }, ...prev].slice(0, 20));
    void procesar(lecturas.length ? nucleo.registrar(lecturas) : []);
    return resultado;
  };

  const estado = nucleo.estadoCorporal();
  const ultimoRelevante = mensajes.find((m) => !m.escalamiento && ORDEN_NIVEL[m.hallazgo.nivel] >= ORDEN_NIVEL.aviso);
  const hallazgosSeleccion = seleccion ? nucleo.hallazgosActuales().filter((h) => seleccion.includes(h.sistema)) : [];
  const c = nucleo.contexto;

  return (
    <div className="app">
      <header>
        <div>
          <h1>Higia <span className="sub">· sistema autónomo de monitoreo de salud</span></h1>
          <p className="estado-red">
            {c.conexionHabitat ? '🟢 Conectado al hábitat' : '⚪ Modo autónomo (sin conexión)'}
            {' · '}{iaActiva ? '✨ IA activa' : ia.configurada ? 'IA en espera de conexión' : 'IA no configurada'}
            {' · '}{nucleo.perfil.nombre} · {NOMBRE_DESTINO[c.destino]} · {c.ubicacion.toUpperCase()} · {c.hora}:00
            {c.climaEspacial === 'tormentaSolar' && ' · ☀️ Tormenta solar'}
          </p>
        </div>
        <div className="acciones-cab">
          <ControlVoz vozActiva={vozActiva} onVozActiva={setVozActiva} />
          <button onClick={() => alternarSimulador(!mostrarSimulador)} aria-pressed={!mostrarSimulador}>
            {mostrarSimulador ? 'Ocultar simulador' : 'Mostrar simulador'}
          </button>
        </div>
      </header>

      <main className="rejilla">
        <div className="columna">
          <section className="tarjeta">
            <h2>Modo pasivo</h2>
            {figura3D
              ? <FiguraCorporal3D estado={estado} seleccion={seleccion} onSeleccionar={setSeleccion} />
              : <FiguraCorporal estado={estado} seleccion={seleccion} onSeleccionar={setSeleccion} />}
          </section>
          {seleccion && (
            <section className="tarjeta">
              <h2>{seleccion.map((s) => NOMBRE_SISTEMA[s]).join(' / ')}</h2>
              {hallazgosSeleccion.length ? (
                <ul className="detalle">
                  {hallazgosSeleccion.map((h) => (
                    <li key={h.riesgoId}>
                      <span className="chip" style={{ background: COLOR_NIVEL[h.nivel] }}>{NOMBRE_NIVEL[h.nivel]}</span>{' '}
                      {redactar(h, nucleo.perfil, c)}
                    </li>
                  ))}
                </ul>
              ) : <p className="vacio">Sin datos para este sistema todavía.</p>}
            </section>
          )}
        </div>

        <div className="columna">
          <section className="tarjeta">
            <h2>Modo proactivo: mensajes al astronauta</h2>
            <PanelMensajes mensajes={mensajes} pendientes={nucleo.confirmacionesPendientes()} ahora={ahora} onConfirmar={confirmar} />
          </section>
          <PanelConversacion historial={chat} vozActiva={vozActiva} iaActiva={iaActiva} onFrase={conversar} />
        </div>

        <div className="columna">
          {mostrarSimulador && <PanelEscenarios onEscenario={ejecutarEscenario} onOcultar={() => alternarSimulador(false)} />}
          <PanelControl perfil={nucleo.perfil} contexto={c} onPerfil={cambiarPerfil} onContexto={cambiarContexto} />
          <PanelCamara
            iaActiva={iaActiva}
            onAnalizar={(imagen) => analizarEntornoIA({ imagen, contexto: { ...c } })}
            onAplicar={cambiarContexto}
          />
          <PanelComparacion mensaje={ultimoRelevante} contexto={c} />
          <PanelInterop conectado={c.conexionHabitat} pendientes={nucleo.hayPendientesReporte()} enviados={interop.enviados} />
        </div>
      </main>
    </div>
  );
}
