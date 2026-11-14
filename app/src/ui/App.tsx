import { useCallback, useEffect, useRef, useState } from 'react';
import { analizarEntornoIA, consultarEstadoIA, conversarIA, estadoParaIA } from '../adaptadores/ia/cliente';
import type { EstadoIA, RespuestaConversacion, TurnoConversacion } from '../adaptadores/ia/contrato';
import { AdaptadorEjemplo } from '../adaptadores/interop/ejemploNasa';
import type { Escenario } from '../adaptadores/simulador/escenarios';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { detener, hablar } from '../adaptadores/voz/voz';
import { interpretar } from '../core/conversacion';
import { NucleoSalud } from '../core/nucleo';
import { REGLAS } from '../core/reglas';
import type { Contexto, Lectura, Mensaje, SistemaCorporal } from '../core/tipos';
import { BannerAlerta, BarraSuperior, Navegacion } from './componentes/Estructura';
import { PanelDemo } from './componentes/PanelDemo';
import { webglDisponible } from './FiguraCorporal3D';
import { SECCIONES, useSeccion } from './navegacion';
import { VistaAsistente, type Intercambio, type ResultadoConversacion } from './vistas/VistaAsistente';
import { VistaEntorno } from './vistas/VistaEntorno';
import { VistaMensajes } from './vistas/VistaMensajes';
import { VistaReportes } from './vistas/VistaReportes';
import { VistaResumen } from './vistas/VistaResumen';

const CONTEXTO_INICIAL: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: true, medicoABordo: false,
  conexionHabitat: false, conexionTierra: false,
};

const CLAVE_DEMO = 'higia.panelDemo';
const leerDemo = () => { try { return localStorage.getItem(CLAVE_DEMO) === 'abierto'; } catch { return false; } };
const guardarDemo = (v: boolean) => { try { localStorage.setItem(CLAVE_DEMO, v ? 'abierto' : 'cerrado'); } catch { /* sin almacenamiento */ } };

const escribiendo = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

export function App() {
  const [nucleo] = useState(() => new NucleoSalud(REGLAS, PERFILES[0], CONTEXTO_INICIAL));
  const [interop] = useState(() => new AdaptadorEjemplo());
  const [figura3D] = useState(webglDisponible);
  const [seccion, ir] = useSeccion();
  const [, setVersion] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [vistoHasta, setVistoHasta] = useState(0);
  const [chat, setChat] = useState<Intercambio[]>([]);
  const [seleccion, setSeleccion] = useState<SistemaCorporal[] | null>(null);
  const [vozActiva, setVozActiva] = useState(true);
  const [demoAbierta, setDemoAbierta] = useState(leerDemo);
  const [ia, setIa] = useState<EstadoIA>({ configurada: false, modelo: '' });
  const turnos = useRef<TurnoConversacion[]>([]);
  const vozRef = useRef(vozActiva);
  vozRef.current = vozActiva;

  const refrescar = () => setVersion((v) => v + 1);
  const c = nucleo.contexto;
  const iaActiva = c.conexionHabitat && ia.configurada;

  useEffect(() => { void consultarEstadoIA().then(setIa); }, []);

  // Título de la pestaña según la sección.
  useEffect(() => {
    document.title = `${SECCIONES.find((s) => s.id === seccion)!.nombre} · Higia`;
    if (seccion === 'mensajes') setVistoHasta(Date.now());
  }, [seccion, mensajes.length]);

  const alternarDemo = useCallback((v?: boolean) => {
    setDemoAbierta((actual) => {
      const nuevo = v ?? !actual;
      guardarDemo(nuevo);
      return nuevo;
    });
  }, []);

  // Atajos: D abre/cierra la demo; Esc cierra la demo o detiene la voz.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (demoAbierta) alternarDemo(false);
        else detener();
      } else if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey && !escribiendo(e)) {
        alternarDemo();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [demoAbierta, alternarDemo]);

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

  const cambiarContexto = (cambios: Partial<Contexto>) => void procesar(nucleo.actualizarContexto(cambios));

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
    setChat((prev) => [{ id: Date.now(), pregunta: frase, respuesta: resultado.texto, fuente: resultado.fuente, nota: resultado.nota }, ...prev].slice(0, 30));
    void procesar(lecturas.length ? nucleo.registrar(lecturas) : []);
    return resultado;
  };

  const vencimientos = nucleo.confirmacionesPendientes();
  const pendientes = mensajes.filter((m) => vencimientos.has(m.id)).map((m) => ({ mensaje: m, vence: vencimientos.get(m.id)! }));
  const nuevos = seccion === 'mensajes' ? 0 : mensajes.filter((m) => m.timestamp > vistoHasta && !m.diferido).length;
  const escaladas = mensajes.filter((m) => m.escalamiento);

  return (
    <div className={`app ${demoAbierta ? 'con-demo' : ''}`}>
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <BarraSuperior
        contexto={c} nombreAstronauta={nucleo.perfil.nombre} iaActiva={iaActiva} iaConfigurada={ia.configurada}
        vozActiva={vozActiva} onVozActiva={setVozActiva} demoAbierta={demoAbierta} onDemo={() => alternarDemo()}
      />
      <BannerAlerta pendientes={pendientes} ahora={ahora} onConfirmar={confirmar} onVer={() => ir('mensajes')} />

      <div className="cuerpo">
        <Navegacion seccion={seccion} onIr={ir} contadores={{ mensajes: nuevos, reportes: 0 }} />

        <main id="contenido" className="contenido" tabIndex={-1}>
          {seccion === 'resumen' && (
            <VistaResumen
              perfil={nucleo.perfil} contexto={c} estado={nucleo.estadoCorporal()} hallazgos={nucleo.hallazgosActuales()}
              figura3D={figura3D} seleccion={seleccion} onSeleccionar={setSeleccion} onIrMensajes={() => ir('mensajes')}
            />
          )}
          {seccion === 'mensajes' && (
            <VistaMensajes mensajes={mensajes} pendientes={vencimientos} ahora={ahora} contexto={c} onConfirmar={confirmar} onAbrirDemo={() => alternarDemo(true)} />
          )}
          {seccion === 'asistente' && <VistaAsistente historial={chat} vozActiva={vozActiva} iaActiva={iaActiva} onFrase={conversar} />}
          {seccion === 'entorno' && (
            <VistaEntorno
              contexto={c} iaActiva={iaActiva} onAplicar={cambiarContexto} onAbrirDemo={() => alternarDemo(true)}
              onAnalizar={(imagen) => analizarEntornoIA({ imagen, contexto: { ...c } })}
            />
          )}
          {seccion === 'reportes' && (
            <VistaReportes conectado={c.conexionHabitat} pendientes={nucleo.hayPendientesReporte()} enviados={interop.enviados} escaladas={escaladas} />
          )}
        </main>
      </div>

      <PanelDemo
        abierto={demoAbierta} onCerrar={() => alternarDemo(false)} perfil={nucleo.perfil} contexto={c}
        onPerfil={cambiarPerfil} onContexto={cambiarContexto} onEscenario={ejecutarEscenario}
      />
    </div>
  );
}
