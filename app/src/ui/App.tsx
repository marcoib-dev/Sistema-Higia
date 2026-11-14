import { useCallback, useEffect, useRef, useState } from 'react';
import { analizarEntornoIA, consultarEstadoIA, conversarIA, estadoParaIA, evaluarIA, peticionEvaluacion } from '../adaptadores/ia/cliente';
import type { EstadoIA, EstadoParaIA, RespuestaConversacion, TurnoConversacion } from '../adaptadores/ia/contrato';
import { AdaptadorEjemplo } from '../adaptadores/interop/ejemploNasa';
import { ESCENARIOS, type Escenario } from '../adaptadores/simulador/escenarios';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { respuestaSimulada } from '../adaptadores/simulador/tripulacion';
import { aceptarRespuestaSinNombre, detener, hablar } from '../adaptadores/voz/voz';
import type { Accion } from '../core/acciones';
import { interpretar } from '../core/conversacion';
import { NucleoSalud } from '../core/nucleo';
import { ChequeoOrientacion } from '../core/orientacion';
import { REGLAS } from '../core/reglas';
import { NOMBRE_SISTEMA, type Comunicacion, type Contexto, type HistoriaClinica, type Lectura, type Mensaje, type Perfil, type SistemaCorporal } from '../core/tipos';
import { useAsistente, type ResultadoConversacion } from './asistente';
import { AccesoHigia } from './componentes/AccesoHigia';
import { BannerAlerta, BannerComunicacion, BarraSuperior, Navegacion } from './componentes/Estructura';
import { PanelDemo } from './componentes/PanelDemo';
import { SECCIONES, useSeccion } from './navegacion';
import { VistaAsistente } from './vistas/VistaAsistente';
import { VistaComunicaciones } from './vistas/VistaComunicaciones';
import { VistaEntorno } from './vistas/VistaEntorno';
import { VistaMensajes, type EvaluacionMensaje } from './vistas/VistaMensajes';
import { VistaPerfil } from './vistas/VistaPerfil';
import { VistaReportes } from './vistas/VistaReportes';
import { VistaResumen } from './vistas/VistaResumen';

const CONTEXTO_INICIAL: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: true, medicoABordo: false,
  conexionHabitat: false, conexionTierra: false,
  diaMision: 45, transicionGravedad: false,
};

/** Segundos antes de escalar en que Higia avisa por voz que va a comunicarse con otros. */
const PREAVISO_ESCALADA_MS = 10_000;

const CLAVE_DEMO = 'higia.panelDemo';
const leerDemo = () => { try { return localStorage.getItem(CLAVE_DEMO) === 'abierto'; } catch { return false; } };
const guardarDemo = (v: boolean) => { try { localStorage.setItem(CLAVE_DEMO, v ? 'abierto' : 'cerrado'); } catch { /* sin almacenamiento */ } };

// La historia clínica editada se guarda en este dispositivo, por astronauta.
const claveHistoria = (id: string) => `higia.historia.${id}`;
const conHistoriaGuardada = (p: Perfil): Perfil => {
  try {
    const h = localStorage.getItem(claveHistoria(p.id));
    return h ? { ...p, historiaClinica: { ...p.historiaClinica, ...(JSON.parse(h) as Partial<HistoriaClinica>) } } : p;
  } catch { return p; }
};
const guardarHistoria = (id: string, h: HistoriaClinica) => { try { localStorage.setItem(claveHistoria(id), JSON.stringify(h)); } catch { /* sin almacenamiento */ } };

const escribiendo = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Acciones que no esperan a la IA: la seguridad no depende de la red. */
const esUrgente = (a: Accion) => a.tipo === 'pedir_ayuda' || a.tipo === 'confirmar_bien' || (a.tipo === 'emitir_alerta' && a.nivel === 'alerta');

export function App() {
  const [nucleo] = useState(() => {
    const n = new NucleoSalud(REGLAS, conHistoriaGuardada(PERFILES[0]), CONTEXTO_INICIAL);
    n.companeros = PERFILES.filter((p) => p.id !== PERFILES[0].id).map((p) => p.nombre);
    return n;
  });
  const [interop] = useState(() => new AdaptadorEjemplo());
  const [seccion, ir] = useSeccion();
  const [, setVersion] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [vistoHasta, setVistoHasta] = useState(0);
  const [seleccion, setSeleccion] = useState<SistemaCorporal[] | null>(null);
  const [vozActiva, setVozActiva] = useState(true);
  const [demoAbierta, setDemoAbierta] = useState(leerDemo);
  const [ia, setIa] = useState<EstadoIA>({ configurada: false, modelo: '' });
  const [evaluaciones, setEvaluaciones] = useState<Record<string, EvaluacionMensaje>>({});
  /** Comunicación de emergencia a destacar en el aviso global (hasta que se cierre). */
  const [avisoComunicacion, setAvisoComunicacion] = useState<{ mensaje: Mensaje; ids: string[] } | null>(null);
  const turnos = useRef<TurnoConversacion[]>([]);
  const preavisados = useRef(new Set<string>());
  /** Chequeo de orientación en curso (preguntas que Higia hace y evalúa en el dispositivo). */
  const chequeo = useRef<ChequeoOrientacion | null>(null);
  /** Impactos en la cabeza para los que ya se pidió el chequeo (no repetirlo al reevaluar). */
  const impactosChequeados = useRef(new Set<number>());
  const decirRef = useRef<(texto: string, hechos?: string[]) => void>(() => {});
  const vozRef = useRef(vozActiva);
  vozRef.current = vozActiva;

  const refrescar = () => setVersion((v) => v + 1);
  const c = nucleo.contexto;
  // La IA se usa siempre que el servidor tenga clave; si falla, todo sigue con el motor local.
  const iaActiva = ia.configurada;
  const iaRef = useRef(iaActiva);
  iaRef.current = iaActiva;

  useEffect(() => { void consultarEstadoIA().then(setIa); }, []);

  // Título de la pestaña según la sección.
  useEffect(() => {
    document.title = seccion === 'asistente' ? 'Higia · Asistente' : `${SECCIONES.find((s) => s.id === seccion)!.nombre} · Higia`;
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

  /**
   * Evaluación de la IA para cada hallazgo nuevo. El mensaje local ya salió (la seguridad no espera a la red);
   * la evaluación lo complementa cuando llega. No se evalúan escaladas, recordatorios ni hallazgos normales.
   */
  const evaluarConIA = useCallback((nuevos: Mensaje[]) => {
    if (!iaRef.current) return;
    for (const m of nuevos) {
      if (m.escalamiento || m.esRecordatorio || m.hallazgo.nivel === 'normal') continue;
      setEvaluaciones((prev) => ({ ...prev, [m.id]: { estado: 'cargando' } }));
      evaluarIA(peticionEvaluacion(m, nucleo)).then(
        (r) => setEvaluaciones((prev) => ({ ...prev, [m.id]: { estado: 'lista', ...r } })),
        (e: unknown) => setEvaluaciones((prev) => ({ ...prev, [m.id]: { estado: 'error', error: e instanceof Error ? e.message : 'Error desconocido.' } })),
      );
    }
  }, [nucleo]);

  /** Simula la respuesta de cada destinatario (en la realidad llega por radio o por la red del hábitat). */
  const programarRespuestas = useCallback((coms: Comunicacion[]) => {
    for (const com of coms) {
      const r = respuestaSimulada(com, nucleo.companeros[0]);
      if (!r) continue;
      setTimeout(() => {
        nucleo.registrarRespuesta(com.id, r.texto);
        if (vozRef.current && com.tipo === 'emergencia') hablar(r.texto);
        setVersion((v) => v + 1);
      }, r.enMs);
    }
  }, [nucleo]);

  /** Empieza el chequeo de orientación y devuelve la primera pregunta (con su presentación). */
  const iniciarChequeo = useCallback((): string => {
    chequeo.current = new ChequeoOrientacion(nucleo.perfil, nucleo.contexto);
    aceptarRespuestaSinNombre(30_000);
    return `Te haré ${chequeo.current.total} preguntas rápidas; responde sin apuro. ${chequeo.current.pregunta()}`;
  }, [nucleo]);

  const procesar = useCallback(async (nuevos: Mensaje[]) => {
    if (vozRef.current) nuevos.filter((m) => m.voz).forEach((m) => hablar(m.texto));
    if (nuevos.length) setMensajes((prev) => [...nuevos, ...prev].slice(0, 100));
    // Tras un golpe en la cabeza medido por el casco, Higia evalúa la orientación por su cuenta.
    for (const m of nuevos) {
      if (m.hallazgo.riesgoId !== 'trauma.craneal' || m.esRecordatorio || m.hallazgo.nivel === 'normal' || m.hallazgo.nivel === 'info') continue;
      const impacto = m.hallazgo.datos?.find((d) => d.sensor === 'impactoCabeza');
      const yaEvaluado = m.hallazgo.datos?.some((d) => d.sensor === 'orientacion');
      if (!impacto || yaEvaluado || impactosChequeados.current.has(impacto.timestamp) || chequeo.current) continue;
      impactosChequeados.current.add(impacto.timestamp);
      decirRef.current(iniciarChequeo(), ['Inicié un chequeo de orientación por el golpe en la cabeza']);
    }
    // Una comunicación de emergencia (escalada o pedido de ayuda) se destaca en toda la app.
    const comunicado = nuevos.find((m) => m.escalamiento?.comunicaciones?.length);
    if (comunicado) {
      const ids = comunicado.escalamiento!.comunicaciones!;
      setAvisoComunicacion({ mensaje: comunicado, ids });
      programarRespuestas(nucleo.comunicaciones().filter((x) => ids.includes(x.id)));
    }
    evaluarConIA(nuevos);
    // La capa de interoperabilidad solo actúa con conexión; si no, el núcleo sigue solo.
    if (nucleo.contexto.conexionHabitat && nucleo.hayPendientesReporte()) {
      await interop.enviar(nucleo.tomarPendientesReporte(), nucleo.perfil);
    }
    refrescar();
  }, [nucleo, interop, evaluarConIA, programarRespuestas, iniciarChequeo]);

  // Cada segundo: preaviso y escalada de alertas sin respuesta. Cada minuto: recordatorios.
  useEffect(() => {
    let segundos = 0;
    const id = setInterval(() => {
      const t = Date.now();
      setAhora(t);
      // Alerta de comunicación: antes de avisar a otros, Higia lo dice para que el astronauta pueda responder.
      for (const [mid, vence] of nucleo.confirmacionesPendientes()) {
        if (vence - t <= PREAVISO_ESCALADA_MS && !preavisados.current.has(mid)) {
          preavisados.current.add(mid);
          const destinos = nucleo.destinosEscalamiento();
          const a = destinos.length ? `aviso a ${destinos.length === 1 ? destinos[0].replace(/ \(.*\)$/, '') : 'otros'}` : 'activo la baliza de emergencia';
          if (vozRef.current) hablar(`No respondiste. En ${Math.round((vence - t) / 1000)} segundos ${a}. Di «Higia, estoy bien» si estás bien.`);
        }
      }
      const nuevos = nucleo.verificarConfirmaciones(t);
      if (++segundos % 60 === 0) nuevos.push(...nucleo.tick(t));
      if (nuevos.length) void procesar(nuevos);
    }, 1000);
    return () => clearInterval(id);
  }, [nucleo, procesar]);

  const cambiarContexto = (cambios: Partial<Contexto>) => {
    void procesar(nucleo.actualizarContexto(cambios));
    // Al recuperar enlace, sale lo que estaba en cola.
    if (cambios.conexionHabitat || cambios.conexionTierra || cambios.companeroCercano) programarRespuestas(nucleo.reintentarCola());
  };

  const ejecutarEscenario = (e: Escenario) => {
    const deContexto = e.contexto ? nucleo.actualizarContexto(e.contexto) : [];
    const t = Date.now();
    void procesar([...deContexto, ...nucleo.registrar(e.lecturas(t, nucleo.historial), t)]);
  };

  const cambiarPerfil = (id: string) => {
    nucleo.cambiarPerfil(conHistoriaGuardada(PERFILES.find((p) => p.id === id)!));
    nucleo.companeros = PERFILES.filter((p) => p.id !== id).map((p) => p.nombre);
    refrescar();
  };

  const cambiarHistoria = (h: HistoriaClinica) => {
    nucleo.cambiarPerfil({ ...nucleo.perfil, historiaClinica: h });
    guardarHistoria(nucleo.perfil.id, h);
    refrescar();
  };

  const restablecerHistoria = () => {
    try { localStorage.removeItem(claveHistoria(nucleo.perfil.id)); } catch { /* sin almacenamiento */ }
    cambiarPerfil(nucleo.perfil.id);
  };

  const confirmar = (id: string) => {
    nucleo.confirmar(id);
    refrescar();
  };

  const pedirAyuda = (motivo = 'Pedido manual desde la app.') => void procesar([nucleo.pedirAyuda('todos', motivo)]);

  /** Ejecuta lo que pidió el asistente. Devuelve, para cada acción, qué se hizo (se muestra en el chat). */
  let chequeoPendiente: string | null = null;
  const ejecutarAcciones = (acciones: Accion[]): string[] => {
    const hechos: string[] = [];
    for (const a of acciones) {
      switch (a.tipo) {
        case 'pedir_ayuda': {
          const m = nucleo.pedirAyuda(a.destino, a.motivo);
          void procesar([{ ...m, voz: false }]); // la respuesta del asistente ya lo dice en voz alta
          hechos.push(`Pedí ayuda a: ${m.escalamiento!.destinos.join(', ')}`);
          break;
        }
        case 'enviar_mensaje': {
          const coms = nucleo.enviarMensaje(a.destino, a.mensaje);
          programarRespuestas(coms);
          hechos.push(...coms.map((x) => `${x.estado === 'enCola' ? 'En cola para' : 'Mensaje enviado a'} ${x.destinatario}`));
          refrescar();
          break;
        }
        case 'emitir_alerta': {
          const ms = nucleo.alertaDesdeConversacion(a);
          void procesar(ms.map((m) => ({ ...m, voz: false })));
          hechos.push(`${a.nivel === 'alerta' ? 'Alerta' : a.nivel === 'aviso' ? 'Aviso' : 'Nota'} registrada: ${a.titulo} (${NOMBRE_SISTEMA[a.sistema]})`);
          break;
        }
        case 'confirmar_bien': {
          const pendientes = [...nucleo.confirmacionesPendientes().keys()];
          pendientes.forEach((id) => nucleo.confirmar(id));
          if (pendientes.length) hechos.push(`Confirmé que estás bien (${pendientes.length} alerta${pendientes.length > 1 ? 's' : ''})`);
          refrescar();
          break;
        }
        case 'ir_a':
          ir(a.seccion);
          hechos.push(`Abrí ${SECCIONES.find((s) => s.id === a.seccion)!.nombre}`);
          break;
        case 'mostrar_sistema':
          setSeleccion([a.sistema]);
          ir('resumen');
          hechos.push(`Mostré ${NOMBRE_SISTEMA[a.sistema]}`);
          break;
        case 'cambiar_contexto': {
          const cambios: Partial<Contexto> = {};
          if (a.ubicacion) cambios.ubicacion = a.ubicacion;
          if (a.actividad) cambios.actividad = a.actividad;
          cambiarContexto(cambios);
          hechos.push('Actualicé el contexto');
          break;
        }
        case 'voz':
          if (a.estado === 'silenciar') { setVozActiva(false); detener(); hechos.push('Voz silenciada'); }
          else if (a.estado === 'activar') { setVozActiva(true); hechos.push('Voz activada'); }
          else { detener(); }
          break;
        case 'actualizar_historia': {
          const h = nucleo.perfil.historiaClinica;
          const nueva: HistoriaClinica = a.campo === 'antecedentes'
            ? { ...h, antecedentes: [...h.antecedentes, { nombre: a.valor }] }
            : { ...h, [a.campo]: [...h[a.campo], a.valor] };
          cambiarHistoria(nueva);
          hechos.push(`Historia clínica: agregué "${a.valor}"`);
          break;
        }
        case 'chequeo_orientacion':
          if (!chequeo.current) { chequeoPendiente = iniciarChequeo(); hechos.push('Inicié un chequeo de orientación'); }
          break;
        case 'ejecutar_escenario': {
          const e = ESCENARIOS.find((x) => x.id === a.escenario || normal(x.nombre) === normal(a.escenario));
          if (e) { ejecutarEscenario(e); hechos.push(`Escenario de la demo: ${e.nombre}`); }
          break;
        }
        case 'cambiar_astronauta': {
          const p = PERFILES.find((x) => x.id === a.astronauta || normal(x.nombre).includes(normal(a.astronauta)));
          if (p) { cambiarPerfil(p.id); hechos.push(`Astronauta: ${p.nombre}`); }
          break;
        }
      }
    }
    return hechos;
  };

  /** Lo que el asistente necesita saber de la app para controlarla. */
  const estadoApp = (): EstadoParaIA['app'] => {
    const vencimientos = nucleo.confirmacionesPendientes();
    return {
      seccion,
      alertasEsperandoRespuesta: mensajes.filter((m) => vencimientos.has(m.id)).map((m) => m.hallazgo.titulo),
      comunicacionesRecientes: nucleo.comunicaciones().slice(0, 5).map((x) => ({ destinatario: x.destinatario, asunto: x.asunto, estado: x.estado })),
      destinosDisponibles: nucleo.destinosEscalamiento(),
      escenariosDemo: ESCENARIOS.map((e) => ({ id: e.id, nombre: e.nombre })),
      astronautasDemo: PERFILES.map((p) => ({ id: p.id, nombre: p.nombre, actual: p.id === nucleo.perfil.id })),
    };
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

  /** Respuesta a una pregunta del chequeo de orientación en curso. */
  const responderChequeo = (frase: string): ResultadoConversacion => {
    const c = chequeo.current!;
    if (/\b(cancela|cancelar|basta|deten|para el chequeo)\b/.test(normal(frase))) {
      chequeo.current = null;
      return { texto: 'De acuerdo, cancelo el chequeo de orientación.', fuente: 'local', hechos: ['Chequeo de orientación cancelado'] };
    }
    c.responder(frase);
    if (!c.terminado) {
      aceptarRespuestaSinNombre(30_000);
      return { texto: c.pregunta()!, fuente: 'local', hechos: [] };
    }
    chequeo.current = null;
    void procesar(nucleo.registrar({ sensor: 'orientacion', valor: c.valor, timestamp: Date.now(), fuente: 'voz' }));
    const texto = c.aciertos === c.total
      ? `Gracias. Respondiste bien las ${c.total} preguntas: estás orientado.`
      : `Gracias. Respondiste bien ${c.aciertos} de ${c.total}. Lo registro y lo tengo en cuenta para cuidarte.`;
    return { texto, fuente: 'local', hechos: [`Chequeo de orientación: ${c.aciertos} de ${c.total} (${c.valor}/10)`] };
  };

  const conversar = async (frase: string): Promise<ResultadoConversacion> => {
    // Seguridad primero: lo urgente que entiende el intérprete local (pedir ayuda, "estoy bien",
    // un síntoma grave) se ejecuta ya, sin esperar a la IA ni depender de la red.
    const local = interpretar(frase, nucleo);
    // Durante el chequeo de orientación, la frase es una respuesta; un pedido de ayuda lo interrumpe.
    if (chequeo.current) {
      if (local.acciones.some((a) => a.tipo === 'pedir_ayuda')) chequeo.current = null;
      else return responderChequeo(frase);
    }
    chequeoPendiente = null;
    const urgentes = local.acciones.filter(esUrgente);
    const hechos = ejecutarAcciones(urgentes);
    const yaHecha = (a: Accion) => urgentes.some((u) => u.tipo === a.tipo && (a.tipo !== 'emitir_alerta' || (u.tipo === 'emitir_alerta' && u.sistema === a.sistema)));

    let resultado: ResultadoConversacion;
    let lecturas: Lectura[];
    try {
      if (!iaActiva) throw new Error('');
      const r = await conversarIA({ frase, historial: turnos.current, estado: estadoParaIA(nucleo, estadoApp()) });
      lecturas = lecturasDesdeIA(r);
      // Lo que el intérprete local detecta de forma determinista (señales de percepción) se registra siempre.
      lecturas.push(...local.lecturas.filter((l) => l.sensor === 'marcadoresPsicoticos' && !lecturas.some((x) => x.sensor === l.sensor)));
      hechos.push(...ejecutarAcciones(r.acciones.filter((a) => !yaHecha(a))));
      resultado = { texto: r.respuesta, fuente: 'ia', hechos };
    } catch (e) {
      // Autonomía primero: sin IA, responde el intérprete local.
      lecturas = local.lecturas;
      hechos.push(...ejecutarAcciones(local.acciones.filter((a) => !esUrgente(a))));
      const motivo = e instanceof Error && e.message ? `IA no disponible (${e.message}). ` : '';
      resultado = { texto: local.texto, fuente: 'local', hechos, nota: motivo ? `${motivo}Respondió el intérprete local.` : undefined };
    }
    if (chequeoPendiente) resultado = { ...resultado, texto: `${resultado.texto} ${chequeoPendiente}` };
    turnos.current = [...turnos.current, { rol: 'astronauta' as const, texto: frase }, { rol: 'higia' as const, texto: resultado.texto }].slice(-12);
    if (lecturas.length) void procesar(nucleo.registrar(lecturas));
    return resultado;
  };

  const asistente = useAsistente(conversar, vozActiva);
  decirRef.current = asistente.decir;

  const vencimientos = nucleo.confirmacionesPendientes();
  const pendientes = mensajes.filter((m) => vencimientos.has(m.id)).map((m) => ({ mensaje: m, vence: vencimientos.get(m.id)! }));
  const nuevos = seccion === 'mensajes' ? 0 : mensajes.filter((m) => m.timestamp > vistoHasta && !m.diferido).length;
  const escaladas = mensajes.filter((m) => m.escalamiento);
  const comunicaciones = nucleo.comunicaciones();

  return (
    <div className={`app ${demoAbierta ? 'con-demo' : ''}`}>
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <BarraSuperior
        contexto={c} nombreAstronauta={nucleo.perfil.nombre} iaActiva={iaActiva} iaConfigurada={ia.configurada}
        escucha={asistente.estadoEscucha} vozActiva={vozActiva} onVozActiva={setVozActiva} demoAbierta={demoAbierta} onDemo={() => alternarDemo()}
      />
      <BannerAlerta pendientes={pendientes} ahora={ahora} onConfirmar={confirmar} onVer={() => ir('mensajes')} />
      {avisoComunicacion && (
        <BannerComunicacion
          mensaje={avisoComunicacion.mensaje} comunicaciones={comunicaciones.filter((x) => avisoComunicacion.ids.includes(x.id))}
          onVer={() => ir('comunicaciones')} onCerrar={() => setAvisoComunicacion(null)}
        />
      )}

      <div className="cuerpo">
        <Navegacion seccion={seccion} onIr={ir} contadores={{ mensajes: nuevos }} />

        <main id="contenido" className="contenido" tabIndex={-1}>
          {seccion === 'asistente' && (
            <VistaAsistente
              asistente={asistente} iaActiva={iaActiva} perfil={nucleo.perfil} hallazgos={nucleo.hallazgosActuales()}
              alertasPendientes={pendientes.length} comunicaciones={comunicaciones} onIr={ir} onPedirAyuda={() => pedirAyuda()}
            />
          )}
          {seccion === 'resumen' && (
            <VistaResumen
              perfil={nucleo.perfil} contexto={c} estado={nucleo.estadoCorporal()} regiones={nucleo.estadoRegiones()} hallazgos={nucleo.hallazgosActuales()}
              seleccion={seleccion} onSeleccionar={setSeleccion} onIrMensajes={() => ir('mensajes')}
            />
          )}
          {seccion === 'mensajes' && (
            <VistaMensajes
              mensajes={mensajes} evaluaciones={evaluaciones} pendientes={vencimientos} ahora={ahora} contexto={c}
              historia={nucleo.perfil.historiaClinica} onConfirmar={confirmar} onAbrirDemo={() => alternarDemo(true)}
            />
          )}
          {seccion === 'comunicaciones' && (
            <VistaComunicaciones comunicaciones={comunicaciones} destinos={nucleo.destinosEscalamiento()} onPedirAyuda={() => pedirAyuda()} />
          )}
          {seccion === 'perfil' && (
            <VistaPerfil perfil={nucleo.perfil} onHistoria={cambiarHistoria} onRestablecer={restablecerHistoria} />
          )}
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

      {seccion !== 'asistente' && <AccesoHigia asistente={asistente} onAbrir={() => ir('asistente')} />}

      <PanelDemo
        abierto={demoAbierta} onCerrar={() => alternarDemo(false)} perfil={nucleo.perfil} contexto={c}
        onPerfil={cambiarPerfil} onContexto={cambiarContexto} onEscenario={ejecutarEscenario}
      />
    </div>
  );
}
