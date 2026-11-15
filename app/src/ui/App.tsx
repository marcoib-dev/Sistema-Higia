import { useCallback, useEffect, useRef, useState } from 'react';
import { analizarEntornoIA, consultarEstadoIA, conversarIA, estadoParaIA, evaluarIA, peticionEvaluacion } from '../adaptadores/ia/cliente';
import type { EstadoIA, EstadoParaIA, RespuestaConversacion, TurnoConversacion } from '../adaptadores/ia/contrato';
import { AdaptadorEjemplo } from '../adaptadores/interop/ejemploNasa';
import { nuevoNucleo } from '../adaptadores/simulador/ejecutor';
import { buscarEscenario, CONTEXTO_BASE, diaNormal, ESCENARIOS } from '../adaptadores/simulador/escenarios';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { RegistroSimulacion } from '../adaptadores/simulador/registro';
import { respuestaSimulada } from '../adaptadores/simulador/tripulacion';
import { prepararPiper } from '../adaptadores/voz/piper';
import { aceptarRespuestaSinNombre, detener, hablar } from '../adaptadores/voz/voz';
import type { Accion, PruebaGuiada } from '../core/acciones';
import { EvaluacionCognitiva } from '../core/cognicion';
import { interpretar } from '../core/conversacion';
import type { NucleoSalud } from '../core/nucleo';
import { ChequeoOrientacion } from '../core/orientacion';
import { elegirPreguntaProactiva, esAfirmativo, esNegativo, preguntaProactiva, type PreguntaProactiva } from '../core/proactivo';
import { enRango, esSensor, INFO_SENSOR, NOMBRE_SISTEMA, type Comunicacion, type Contexto, type HistoriaClinica, type Lectura, type Mensaje, type Perfil, type SistemaCorporal } from '../core/tipos';
import { useAsistente, type ResultadoConversacion } from './asistente';
import { AccesoHigia } from './componentes/AccesoHigia';import { AuraHigia } from './componentes/AuraHigia';
import { BannerAlerta, BannerComunicacion, BarraSuperior, Navegacion } from './componentes/Estructura';
import { SECCIONES, useSeccion } from './navegacion';
import { useIdioma, useT } from './idioma';
import { BarraReproduccion } from './simulador/BarraReproduccion';
import { CoberturaPantallaCompleta } from './simulador/CoberturaHRP';
import { PanelSimulador } from './simulador/PanelSimulador';
import { useSimulador } from './simulador/useSimulador';
import { VistaAsistente, type EnCurso } from './vistas/VistaAsistente';
import { VistaPruebas } from './vistas/VistaPruebas';
import { VistaComunicaciones } from './vistas/VistaComunicaciones';
import { VistaEntorno } from './vistas/VistaEntorno';
import { VistaMensajes, type EvaluacionMensaje } from './vistas/VistaMensajes';
import { VistaPerfil } from './vistas/VistaPerfil';
import { VistaReportes } from './vistas/VistaReportes';
import { VistaResumen } from './vistas/VistaResumen';

const CONTEXTO_INICIAL: Contexto = CONTEXTO_BASE;

/** Segundos antes de escalar en que Higia avisa por voz que va a comunicarse con otros. */
const PREAVISO_ESCALADA_MS = 10_000;

const CLAVE_DEMO = 'higia.panelDemo';
const leerDemo = () => { try { return localStorage.getItem(CLAVE_DEMO) === 'abierto'; } catch { return false; } };
const guardarDemo = (v: boolean) => { try { localStorage.setItem(CLAVE_DEMO, v ? 'abierto' : 'cerrado'); } catch { /* sin almacenamiento */ } };
const CLAVE_PROACTIVO = 'higia.proactivo.min';
const leerProactivo = () => { try { const v = localStorage.getItem(CLAVE_PROACTIVO); return v === null ? 5 : Number(v) || 0; } catch { return 5; } };
const guardarProactivo = (v: number) => { try { localStorage.setItem(CLAVE_PROACTIVO, String(v)); } catch { /* sin almacenamiento */ } };
/** Una pregunta proactiva sin respuesta deja de esperar respuesta después de esto. */
const VIGENCIA_PREGUNTA_MS = 2 * 60_000;
const CLAVE_AMPLIO = 'higia.simulador.amplio';
const leerAmplio = () => { try { return localStorage.getItem(CLAVE_AMPLIO) === 'si'; } catch { return false; } };
const guardarAmplio = (v: boolean) => { try { localStorage.setItem(CLAVE_AMPLIO, v ? 'si' : 'no'); } catch { /* sin almacenamiento */ } };

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
const ORDEN = { normal: 0, info: 1, aviso: 2, alerta: 3 } as const;

/** Acciones que no esperan a la IA: la seguridad no depende de la red. */
const esUrgente = (a: Accion) => a.tipo === 'pedir_ayuda' || a.tipo === 'confirmar_bien' || (a.tipo === 'emitir_alerta' && a.nivel === 'alerta');
/**
 * Pedidos explícitos que el intérprete local reconoce sin ambigüedad (una evaluación, una prueba guiada):
 * se ejecutan siempre, aunque la IA no los devuelva como acción.
 */
const esInmediata = (a: Accion) => esUrgente(a) || a.tipo === 'evaluacion_cognitiva' || a.tipo === 'prueba_guiada' || a.tipo === 'chequeo_orientacion';

export function App() {
  const t = useT();
  const { idioma } = useIdioma();
  // El núcleo se puede reemplazar: el simulador reinicia con uno limpio entre escenarios.
  const [nucleo, setNucleo] = useState<NucleoSalud>(() => nuevoNucleo(conHistoriaGuardada(PERFILES[0]), CONTEXTO_INICIAL));
  /** Cambia en cada reinicio: los temporizadores de un núcleo anterior no deben actuar sobre el nuevo. */
  const generacion = useRef(0);
  const [registro] = useState(() => new RegistroSimulacion());
  const simRef = useRef<ReturnType<typeof useSimulador> | null>(null);
  const [interop] = useState(() => new AdaptadorEjemplo());
  const [seccion, ir] = useSeccion();
  const [, setVersion] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [vistoHasta, setVistoHasta] = useState(0);
  const [seleccion, setSeleccion] = useState<SistemaCorporal[] | null>(null);
  const [vozActiva, setVozActiva] = useState(true);
  const [demoAbierta, setDemoAbierta] = useState(leerDemo);
  const [simAmplio, setSimAmplio] = useState(leerAmplio);
  /** Inicio de la EVA en curso iniciada desde el simulador (emite la duración cada minuto). */
  const [evaDesde, setEvaDesde] = useState<number | null>(null);
  const evaRef = useRef<number | null>(null);
  evaRef.current = evaDesde;
  const [coberturaCompleta, setCoberturaCompleta] = useState(false);
  /** Modo grabación: solo la app del astronauta, sin controles del simulador ni cursor quieto. */
  const [grabando, setGrabando] = useState(false);
  const [cursorQuieto, setCursorQuieto] = useState(false);
  const [ia, setIa] = useState<EstadoIA>({ configurada: false, modelo: '' });
  const [evaluaciones, setEvaluaciones] = useState<Record<string, EvaluacionMensaje>>({});
  /** Comunicación de emergencia a destacar en el aviso global (hasta que se cierre). */
  const [avisoComunicacion, setAvisoComunicacion] = useState<{ mensaje: Mensaje; ids: string[] } | null>(null);
  const turnos = useRef<TurnoConversacion[]>([]);
  const preavisados = useRef(new Set<string>());
  /** Chequeo de orientación en curso (preguntas que Higia hace y evalúa en el dispositivo). */
  const chequeo = useRef<ChequeoOrientacion | null>(null);
  /** Evaluación cognitiva en curso (seis preguntas, se evalúan en el dispositivo). */
  const evaluacion = useRef<EvaluacionCognitiva | null>(null);
  /** Pregunta que Higia hizo por iniciativa propia y espera respuesta. */
  const pendiente = useRef<{ pregunta: PreguntaProactiva; desde: number } | null>(null);
  /** Cuándo se hizo cada pregunta proactiva (no repetirlas seguido). */
  const hechas = useRef<Record<string, number>>({});
  const ultimaProactiva = useRef(Date.now());
  const [proactivo, setProactivo] = useState(leerProactivo);
  const [pruebaPedida, setPruebaPedida] = useState<PruebaGuiada | null>(null);
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
  // Voz neuronal local: se prepara al abrir; mientras tanto (o si falla) habla la voz del navegador.
  useEffect(() => { void prepararPiper(); }, []);

  // Título de la pestaña según la sección.
  useEffect(() => {
    document.title = seccion === 'asistente' ? `Higia · ${t('Asistente')}` : `${t(SECCIONES.find((s) => s.id === seccion)!.nombre)} · Higia`;
    if (seccion === 'mensajes') setVistoHasta(Date.now());
  }, [seccion, mensajes.length, t]);

  const alternarDemo = useCallback((v?: boolean) => {
    setDemoAbierta((actual) => {
      const nuevo = v ?? !actual;
      guardarDemo(nuevo);
      return nuevo;
    });
  }, []);

  // Atajos: D abre/cierra el simulador; G, modo grabación; Esc cierra el simulador o detiene la voz.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (demoAbierta) alternarDemo(false);
        else detener();
      } else if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey && !escribiendo(e)) {
        alternarDemo();
      } else if (e.key.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey && !escribiendo(e)) {
        setGrabando((g) => !g);
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [demoAbierta, alternarDemo]);

  // En modo grabación el cursor se oculta a los 2 s sin moverse.
  useEffect(() => {
    if (!grabando) { setCursorQuieto(false); return; }
    let id = setTimeout(() => setCursorQuieto(true), 2000);
    const mover = () => { setCursorQuieto(false); clearTimeout(id); id = setTimeout(() => setCursorQuieto(true), 2000); };
    window.addEventListener('pointermove', mover);
    return () => { clearTimeout(id); window.removeEventListener('pointermove', mover); };
  }, [grabando]);

  /**
   * Evaluación de la IA para cada hallazgo nuevo. El mensaje local ya salió (la seguridad no espera a la red);
   * la evaluación lo complementa cuando llega. No se evalúan escaladas, recordatorios ni hallazgos normales.
   */
  const evaluarConIA = useCallback((nuevos: Mensaje[]) => {
    if (!iaRef.current) return;
    // Durante un escenario, cada mensaje sería una llamada con costo: solo si se activa a propósito.
    const sim = simRef.current;
    if (sim?.activo && !sim.iaEnSimulador) return;
    for (const m of nuevos) {
      if (m.escalamiento || m.esRecordatorio || m.hallazgo.nivel === 'normal') continue;
      setEvaluaciones((prev) => ({ ...prev, [m.id]: { estado: 'cargando' } }));
      evaluarIA({ ...peticionEvaluacion(m, nucleo), idioma }).then(
        (r) => setEvaluaciones((prev) => ({ ...prev, [m.id]: { estado: 'lista', ...r } })),
        (e: unknown) => setEvaluaciones((prev) => ({ ...prev, [m.id]: { estado: 'error', error: e instanceof Error ? e.message : 'Error desconocido.' } })),
      );
    }
  }, [nucleo, idioma]);

  /** Simula la respuesta de cada destinatario (en la realidad llega por radio o por la red del hábitat). */
  const programarRespuestas = useCallback((coms: Comunicacion[]) => {
    const gen = generacion.current;
    for (const com of coms) {
      const r = respuestaSimulada(com, nucleo.companeros[0], simRef.current?.conductaRef.current);
      if (!r) continue;
      setTimeout(() => {
        if (gen !== generacion.current) return; // el núcleo se reinició: esta respuesta ya no aplica
        nucleo.registrarRespuesta(com.id, r.texto);
        registro.agregar({ tipo: 'respuesta', texto: r.texto });
        if (vozRef.current && com.tipo === 'emergencia') hablar(r.texto);
        setVersion((v) => v + 1);
      }, r.enMs);
    }
  }, [nucleo, registro]);

  /** Empieza el chequeo de orientación y devuelve la primera pregunta (con su presentación). */
  const iniciarChequeo = useCallback((): string => {
    chequeo.current = new ChequeoOrientacion(nucleo.perfil, nucleo.contexto);
    aceptarRespuestaSinNombre(30_000);
    return `Te haré ${chequeo.current.total} preguntas rápidas; responde sin apuro. ${chequeo.current.pregunta()}`;
  }, [nucleo]);

  /** Empieza la evaluación cognitiva y devuelve la presentación con la primera pregunta. */
  const iniciarEvaluacion = useCallback((): string => {
    pendiente.current = null;
    evaluacion.current = new EvaluacionCognitiva();
    aceptarRespuestaSinNombre(45_000);
    return `Son ${evaluacion.current.total} preguntas cortas; responde con calma, sin decir «Higia». ${evaluacion.current.pregunta()}`;
  }, []);

  const procesar = useCallback(async (nuevos: Mensaje[]) => {
    const enSimulador = !!simRef.current?.activo;
    // En el simulador varios hallazgos de un mismo paso no se leen seguidos: se lee el de mayor nivel.
    const aLeer = nuevos.filter((m) => m.voz).sort((a, b) => ORDEN[b.hallazgo.nivel] - ORDEN[a.hallazgo.nivel]);
    if (vozRef.current) (enSimulador ? aLeer.slice(0, 1) : aLeer).forEach((m) => hablar(m.texto));
    for (const m of nuevos) {
      if (m.escalamiento) registro.agregar({ tipo: 'escalada', texto: m.texto, nivel: m.hallazgo.nivel, detalle: m.escalamiento.motivo });
      else registro.agregar({ tipo: 'mensaje', texto: `${m.hallazgo.titulo}${m.diferido ? ' (retenido)' : ''}`, nivel: m.hallazgo.nivel, detalle: `${m.motivo} [${m.hallazgo.riesgoId}]` });
    }
    if (nuevos.some((m) => m.escalamiento?.origen === 'escalada')) simRef.current?.notificarEscalada();
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
  }, [nucleo, interop, evaluarConIA, programarRespuestas, iniciarChequeo, registro]);

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
      if (++segundos % 60 === 0) {
        // EVA en curso: el traje informa cuánto lleva fuera.
        if (evaRef.current) nuevos.push(...nucleo.registrar({ sensor: 'duracionEva', valor: Math.floor((t - evaRef.current) / 60_000), timestamp: t, fuente: 'simulador' }, t));
        nuevos.push(...nucleo.tick(t));
      }
      if (nuevos.length) void procesar(nuevos);
    }, 1000);
    return () => clearInterval(id);
  }, [nucleo, procesar]);

  const cambiarContexto = (cambios: Partial<Contexto>) => {
    registro.agregar({ tipo: 'contexto', texto: Object.entries(cambios).map(([k, v]) => `${k}: ${String(v)}`).join(', ') });
    void procesar(nucleo.actualizarContexto(cambios));
    // Al recuperar enlace, sale lo que estaba en cola.
    if (cambios.conexionHabitat || cambios.conexionTierra || cambios.companeroCercano) programarRespuestas(nucleo.reintentarCola());
  };

  /** Núcleo limpio (lo pide el simulador): se borra todo lo que dependía del anterior. */
  const reiniciarNucleo = (perfil: Perfil, contexto: Contexto): NucleoSalud => {
    detener();
    generacion.current++;
    const n = nuevoNucleo(conHistoriaGuardada(perfil), contexto);
    setNucleo(n);
    setMensajes([]);
    setEvaluaciones({});
    setAvisoComunicacion(null);
    setSeleccion(null);
    setEvaDesde(null);
    turnos.current = [];
    preavisados.current.clear();
    chequeo.current = null;
    evaluacion.current = null;
    pendiente.current = null;
    impactosChequeados.current.clear();
    return n;
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
          if (!chequeo.current) { evaluacion.current = null; chequeoPendiente = iniciarChequeo(); hechos.push('Inicié un chequeo de orientación'); }
          break;
        case 'evaluacion_cognitiva':
          if (!evaluacion.current && !chequeo.current) { chequeoPendiente = iniciarEvaluacion(); hechos.push('Inicié la evaluación cognitiva'); }
          break;
        case 'prueba_guiada':
          setPruebaPedida(a.prueba);
          ir('pruebas');
          hechos.push(`Abrí la prueba guiada: ${a.prueba === 'isometrica' ? 'fuerza isométrica' : a.prueba === 'valsalva' ? 'maniobra de Valsalva' : 'tiempo de reacción'}`);
          break;
        case 'ejecutar_escenario': {
          const e = buscarEscenario(a.escenario);
          if (e) { sim.ejecutarEscenario(e); hechos.push(`Escenario del simulador: ${e.nombre}`); }
          break;
        }
        case 'control_simulador':
          if (sim.activo) { sim.control(a.orden); hechos.push(`Simulador: ${a.orden}`); }
          break;
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
      enCurso: evaluacion.current ? `Evaluación cognitiva, pregunta ${evaluacion.current.respondidas + 1} de ${evaluacion.current.total}`
        : chequeo.current ? 'Chequeo de orientación'
        : pendiente.current ? `Higia le preguntó: «${pendiente.current.pregunta.texto}»` : undefined,
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
    // Lo que llega de la IA se valida: datos desconocidos se descartan y los valores se recortan al rango.
    return r.lecturas.filter(({ sensor, valor }) => Number.isFinite(valor) && (sensor === 'minutosEjercicioRealizados' || esSensor(sensor))).map(({ sensor, valor }): Lectura => {
      if (sensor !== 'minutosEjercicioRealizados') return { sensor, valor: enRango(sensor, valor), timestamp: t, fuente: 'voz' as const };
      const previo = nucleo.historial.ultima('minutosEjercicio');
      const mismoDia = previo && new Date(previo.timestamp).toDateString() === new Date(t).toDateString();
      return { sensor: 'minutosEjercicio' as const, valor: enRango('minutosEjercicio', (mismoDia ? previo.valor : 0) + valor), timestamp: t, fuente: 'voz' as const };
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
      return { texto: c.pregunta()!, fuente: 'local', hechos: [], etiqueta: 'Chequeo de orientación' };
    }
    chequeo.current = null;
    void procesar(nucleo.registrar({ sensor: 'orientacion', valor: c.valor, timestamp: Date.now(), fuente: 'voz' }));
    const texto = c.aciertos === c.total
      ? `Gracias. Respondiste bien las ${c.total} preguntas: estás orientado.`
      : `Gracias. Respondiste bien ${c.aciertos} de ${c.total}. Lo registro y lo tengo en cuenta para cuidarte.`;
    return { texto, fuente: 'local', hechos: [`Chequeo de orientación: ${c.aciertos} de ${c.total} (${c.valor}/10)`] };
  };

  /** Respuesta a una pregunta de la evaluación cognitiva en curso. */
  const responderEvaluacion = (frase: string): ResultadoConversacion => {
    const e = evaluacion.current!;
    if (/\b(cancela|cancelar|basta|deten|para la (prueba|evaluacion)|no quiero seguir)\b/.test(normal(frase))) {
      evaluacion.current = null;
      return { texto: 'De acuerdo, dejamos la evaluación para otro momento.', fuente: 'local', hechos: ['Evaluación cognitiva cancelada'] };
    }
    e.responder(frase);
    if (!e.terminado) {
      aceptarRespuestaSinNombre(45_000);
      return { texto: e.pregunta()!, fuente: 'local', hechos: [], etiqueta: `Evaluación cognitiva · ${e.respondidas + 1} de ${e.total}` };
    }
    evaluacion.current = null;
    void procesar(nucleo.registrar({ sensor: 'cognicion', valor: e.valor, timestamp: Date.now(), fuente: 'voz' }));
    const base = nucleo.perfil.lineaBase.cognicion ?? 85;
    const fallas = e.dominiosConFallas();
    const habitual = e.valor >= base * 0.85;
    const texto = habitual
      ? `Listo, gracias. Obtuviste ${e.valor} de 100: dentro de lo habitual para ti.${fallas.length ? ` Fallaste un poco en ${fallas.join(' y ')}, nada fuera de lo común.` : ''}`
      : `Gracias. Obtuviste ${e.valor} de 100, por debajo de lo habitual para ti. Costaron ${fallas.join(', ')}. Puede ser cansancio o falta de sueño: lo registro y lo tengo en cuenta.`;
    return { texto, fuente: 'local', hechos: [`Evaluación cognitiva: ${e.valor}/100 (habitual ${base}) · tiempo medio de respuesta ${e.latenciaMedia} s`] };
  };

  /** Higia hace una pregunta por iniciativa propia (o a pedido, con `forzar`). */
  const lanzarProactiva = (forzar = false) => {
    const t = Date.now();
    ultimaProactiva.current = t;
    const reciente = hechas.current.cognitiva && t - hechas.current.cognitiva < 600_000;
    const p = elegirPreguntaProactiva(nucleo, t, hechas.current) ?? (forzar ? preguntaProactiva(reciente ? 'molestias' : 'cognitiva')! : null);
    if (!p) return;
    hechas.current[p.id] = t;
    pendiente.current = { pregunta: p, desde: t };
    aceptarRespuestaSinNombre(30_000);
    turnos.current = [...turnos.current, { rol: 'higia' as const, texto: p.texto }].slice(-12);
    registro.agregar({ tipo: 'mensaje', texto: `Pregunta proactiva: ${p.texto}`, nivel: 'info', detalle: p.id });
    asistente.decir(p.texto, [], p.tipo === 'cognitiva' ? 'Higia propone' : 'Pregunta de Higia');
    refrescar();
  };

  /** Respuesta a una pregunta proactiva. Devuelve null si la frase es otra cosa (sigue la conversación normal). */
  const responderProactiva = (frase: string): ResultadoConversacion | null => {
    const { pregunta: p } = pendiente.current!;
    pendiente.current = null;
    if (p.tipo === 'cognitiva') {
      if (esAfirmativo(frase)) return { texto: `Perfecto. ${iniciarEvaluacion()}`, fuente: 'local', hechos: ['Inicié la evaluación cognitiva'], etiqueta: 'Evaluación cognitiva · 1 de 6' };
      if (esNegativo(frase)) return { texto: 'De acuerdo, te lo propongo más tarde.', fuente: 'local', hechos: [] };
      return null;
    }
    if (p.tipo === 'dato' && p.sensor && p.leer) {
      const v = p.leer(frase);
      if (v !== null) {
        void procesar(nucleo.registrar({ sensor: p.sensor, valor: v, timestamp: Date.now(), fuente: 'voz' }));
        return { texto: p.confirmar?.(v) ?? 'Anotado.', fuente: 'local', hechos: [`Registré ${INFO_SENSOR[p.sensor].nombre.toLowerCase()}: ${v}${INFO_SENSOR[p.sensor].unidad.startsWith('/') ? '' : ' '}${INFO_SENSOR[p.sensor].unidad}`] };
      }
      if (esNegativo(frase)) return { texto: 'Está bien, no pasa nada.', fuente: 'local', hechos: [] };
      return null;
    }
    if (p.tipo === 'abierta' && esNegativo(frase)) return { texto: 'Me alegra. Sigo atenta; avísame si algo cambia.', fuente: 'local', hechos: [] };
    return null;
  };

  const conversar = async (frase: string): Promise<ResultadoConversacion> => {
    // Seguridad primero: lo urgente que entiende el intérprete local (pedir ayuda, "estoy bien",
    // un síntoma grave) se ejecuta ya, sin esperar a la IA ni depender de la red.
    const local = interpretar(frase, nucleo);
    const pideAyuda = local.acciones.some((a) => a.tipo === 'pedir_ayuda');
    // Durante el chequeo de orientación o la evaluación, la frase es una respuesta; un pedido de ayuda los interrumpe.
    if (chequeo.current) {
      if (pideAyuda) chequeo.current = null;
      else return responderChequeo(frase);
    }
    if (evaluacion.current) {
      if (pideAyuda) evaluacion.current = null;
      else return responderEvaluacion(frase);
    }
    if (pendiente.current) {
      if (pideAyuda || Date.now() - pendiente.current.desde > VIGENCIA_PREGUNTA_MS) pendiente.current = null;
      else {
        const r = responderProactiva(frase);
        if (r) {
          turnos.current = [...turnos.current, { rol: 'astronauta' as const, texto: frase }, { rol: 'higia' as const, texto: r.texto }].slice(-12);
          return r;
        }
      }
    }
    chequeoPendiente = null;
    const urgentes = local.acciones.filter(esInmediata);
    const hechos = ejecutarAcciones(urgentes);
    const yaHecha = (a: Accion) => urgentes.some((u) => u.tipo === a.tipo && (a.tipo !== 'emitir_alerta' || (u.tipo === 'emitir_alerta' && u.sistema === a.sistema)));

    let resultado: ResultadoConversacion;
    let lecturas: Lectura[];
    // Pedido explícito de una evaluación o prueba: responde el intérprete local, sin esperar a la IA.
    const soloPrueba = local.acciones.length > 0 && local.acciones.every((a) => a.tipo === 'evaluacion_cognitiva' || a.tipo === 'prueba_guiada');
    try {
      if (!iaActiva || soloPrueba) throw new Error('');
      const r = await conversarIA({ frase, historial: turnos.current, estado: estadoParaIA(nucleo, estadoApp()), idioma });
      lecturas = lecturasDesdeIA(r);
      // Lo que el intérprete local detecta de forma determinista (señales de percepción) se registra siempre.
      lecturas.push(...local.lecturas.filter((l) => l.sensor === 'marcadoresPsicoticos' && !lecturas.some((x) => x.sensor === l.sensor)));
      hechos.push(...ejecutarAcciones(r.acciones.filter((a) => !yaHecha(a))));
      resultado = { texto: r.respuesta, fuente: 'ia', hechos };
    } catch (e) {
      // Autonomía primero: sin IA, responde el intérprete local.
      lecturas = local.lecturas;
      hechos.push(...ejecutarAcciones(local.acciones.filter((a) => !esInmediata(a))));
      const motivo = e instanceof Error && e.message ? `IA no disponible (${e.message}). ` : '';
      resultado = { texto: local.texto, fuente: 'local', hechos, nota: motivo ? `${motivo}Respondió el intérprete local.` : undefined };
    }
    if (chequeoPendiente) {
      // (La acción pudo empezar la evaluación durante esta misma frase.)
      const ev = evaluacion.current as EvaluacionCognitiva | null;
      const etiqueta = ev ? `Evaluación cognitiva · 1 de ${ev.total}` : 'Chequeo de orientación';
      resultado = { ...resultado, texto: `${resultado.texto} ${chequeoPendiente}`, etiqueta };
    }
    turnos.current = [...turnos.current, { rol: 'astronauta' as const, texto: frase }, { rol: 'higia' as const, texto: resultado.texto }].slice(-12);
    if (lecturas.length) void procesar(nucleo.registrar(lecturas));
    return resultado;
  };

  const asistente = useAsistente(conversar, vozActiva);
  decirRef.current = asistente.decir;

  const sim = useSimulador({
    nucleo, registro, reiniciarNucleo, procesar: (ms) => void procesar(ms), cambiarContexto,
    decirFrase: (f) => void asistente.enviar(f, 'texto'),
  });
  simRef.current = sim;

  // ── Preguntas proactivas: de vez en cuando Higia pregunta lo que le falta saber ──
  const lanzarRef = useRef(lanzarProactiva);
  lanzarRef.current = lanzarProactiva;
  const ocupadoRef = useRef(false);
  ocupadoRef.current = !!evaluacion.current || !!chequeo.current || asistente.pensando || asistente.hablando
    || asistente.actividad === 'escuchando' || nucleo.confirmacionesPendientes().size > 0 || sim.activo || grabando;
  const interaccionRef = useRef(asistente.ultimaInteraccion);
  interaccionRef.current = asistente.ultimaInteraccion;
  useEffect(() => {
    if (!proactivo) return;
    const id = setInterval(() => {
      const t = Date.now();
      if (pendiente.current && t - pendiente.current.desde > VIGENCIA_PREGUNTA_MS) pendiente.current = null;
      if (ocupadoRef.current || pendiente.current) return;
      // Cuenta desde la última pregunta o desde que el astronauta habló por última vez: no interrumpe una conversación.
      if (t - Math.max(ultimaProactiva.current, interaccionRef.current) < proactivo * 60_000) return;
      lanzarRef.current();
    }, 5000);
    return () => clearInterval(id);
  }, [proactivo]);
  const cambiarProactivo = (min: number) => { setProactivo(min); guardarProactivo(min); ultimaProactiva.current = Date.now(); };

  const enCurso: EnCurso | null = evaluacion.current
    ? { titulo: t('Evaluación cognitiva'), paso: evaluacion.current.respondidas + 1, total: evaluacion.current.total }
    : chequeo.current ? { titulo: t('Chequeo de orientación'), paso: chequeo.current.respuestas.length + 1, total: chequeo.current.total }
    : pendiente.current ? {
      titulo: t('Higia te hizo una pregunta'),
      rapidas: pendiente.current.pregunta.tipo === 'cognitiva' ? ['Sí, empecemos', 'Ahora no']
        : pendiente.current.pregunta.tipo === 'abierta' ? ['No, estoy bien', 'Me duele la cabeza']
        : pendiente.current.pregunta.sensor === 'horasSueno' ? ['5 horas', '7 horas', '8 horas']
        : pendiente.current.pregunta.sensor === 'hidratacion' ? ['4 vasos', '8 vasos']
        : ['3', '5', '7', '9'],
    } : null;

  /** Resultado de una prueba guiada (sección Pruebas): entra como dato y Higia lo comenta. */
  const registrarPrueba = (lecturas: Lectura[], resumen: string) => {
    registro.agregar({ tipo: 'lecturas', texto: `Prueba guiada: ${lecturas.map((l) => `${l.sensor} ${l.valor}`).join(', ')}` });
    const ms = nucleo.registrar(lecturas);
    void procesar(ms.map((m) => ({ ...m, voz: false })));
    const h = ms.find((m) => lecturas.some((l) => m.hallazgo.datos?.some((d) => d.sensor === l.sensor)))?.hallazgo;
    const conclusion = !h || h.nivel === 'normal' ? 'Está dentro de lo habitual.' : `${h.titulo}. ${h.accionPorUbicacion?.[nucleo.contexto.ubicacion] ?? h.accion}`;
    asistente.decir(`${resumen} ${conclusion}`, [`Registré el resultado de la prueba`], 'Resultado de la prueba');
  };

  // ── Acciones del simulador ──
  const inyectar = (ls: Lectura[]) => {
    registro.agregar({ tipo: 'lecturas', texto: `Manual: ${ls.map((l) => `${l.sensor} ${l.valor}`).join(', ')}` });
    void procesar(nucleo.registrar(ls));
  };
  const cargarDiaNormal = () => {
    registro.agregar({ tipo: 'lecturas', texto: 'Día normal: todos los datos en rango' });
    void procesar(nucleo.registrar(diaNormal(Date.now(), nucleo.perfil, nucleo.historial)));
  };
  const iniciarEva = (minutosPrerrespiracion: number) => {
    const t = Date.now();
    void procesar(nucleo.registrar([
      { sensor: 'prerrespiracion', valor: minutosPrerrespiracion, timestamp: t, fuente: 'simulador' },
      { sensor: 'duracionEva', valor: 0, timestamp: t, fuente: 'simulador' },
    ]));
    setEvaDesde(t);
    cambiarContexto({ ubicacion: 'eva' });
  };
  const terminarEva = () => {
    setEvaDesde(null);
    cambiarContexto({ ubicacion: 'habitat' });
  };
  const limpiarPedida = useCallback(() => setPruebaPedida(null), []);
  const cambiarAmplio = (v: boolean) => { setSimAmplio(v); guardarAmplio(v); };

  const vencimientos = nucleo.confirmacionesPendientes();
  const pendientes = mensajes.filter((m) => vencimientos.has(m.id)).map((m) => ({ mensaje: m, vence: vencimientos.get(m.id)! }));
  const nuevos = seccion === 'mensajes' ? 0 : mensajes.filter((m) => m.timestamp > vistoHasta && !m.diferido).length;
  const escaladas = mensajes.filter((m) => m.escalamiento);
  const comunicaciones = nucleo.comunicaciones();

  return (
    <div className={[
      'app', demoAbierta && !grabando && 'con-demo', demoAbierta && simAmplio && 'sim-amplio', sim.activo && !grabando && 'con-reproductor',
      grabando && 'modo-grabacion', cursorQuieto && 'cursor-oculto',
    ].filter(Boolean).join(' ')}>
      <a href="#contenido" className="saltar">{t('Saltar al contenido')}</a>
      <BarraSuperior
        contexto={c} nombreAstronauta={nucleo.perfil.nombre} iaActiva={iaActiva} iaConfigurada={ia.configurada}
        escucha={asistente.estadoEscucha} actividad={asistente.actividad} ahora={ahora} vozActiva={vozActiva} onVozActiva={setVozActiva} demoAbierta={demoAbierta} onDemo={() => alternarDemo()}
      />
      <BannerAlerta pendientes={pendientes} ahora={ahora} onConfirmar={confirmar} onVer={() => ir('mensajes')} />
      {avisoComunicacion && (
        <BannerComunicacion
          mensaje={avisoComunicacion.mensaje} comunicaciones={comunicaciones.filter((x) => avisoComunicacion.ids.includes(x.id))}
          ahora={ahora} onVer={() => ir('comunicaciones')} onCerrar={() => setAvisoComunicacion(null)}
        />
      )}

      <div className="cuerpo">
        <Navegacion seccion={seccion} onIr={ir} contadores={{ mensajes: nuevos }} />

        <main id="contenido" className="contenido" tabIndex={-1}>
          {seccion === 'asistente' && (
            <VistaAsistente
              asistente={asistente} iaActiva={iaActiva} perfil={nucleo.perfil} hallazgos={nucleo.hallazgosActuales()}
              alertasPendientes={pendientes.length} enCurso={enCurso} proactivo={proactivo} onProactivo={cambiarProactivo}
              onPreguntarAhora={() => lanzarProactiva(true)} onAbrirSimulador={() => alternarDemo(true)} onIr={ir} onPedirAyuda={() => pedirAyuda()}
            />
          )}
          {seccion === 'pruebas' && (
            <VistaPruebas
              nucleo={nucleo} vozActiva={vozActiva} pedida={pruebaPedida} onPedidaAtendida={limpiarPedida} onRegistrar={registrarPrueba}
              onEvaluacionCognitiva={() => { ir('asistente'); void asistente.enviar(t('Hazme una evaluación cognitiva')); }}
              onChequeoOrientacion={() => { ir('asistente'); void asistente.enviar(t('Hazme un chequeo de orientación')); }}
            />
          )}
          {seccion === 'resumen' && (
            <VistaResumen
              perfil={nucleo.perfil} contexto={c} estado={nucleo.estadoCorporal()} regiones={nucleo.estadoRegiones()} hallazgos={nucleo.hallazgosActuales()}
              aptitud={nucleo.aptitudTareas()}
              seleccion={seleccion} onSeleccionar={setSeleccion} onIrMensajes={() => ir('mensajes')}
            />
          )}
          {seccion === 'mensajes' && (
            <VistaMensajes
              mensajes={mensajes} evaluaciones={evaluaciones} pendientes={vencimientos} ahora={ahora} contexto={c} historial={nucleo.historial}
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
              onAnalizar={(imagen) => analizarEntornoIA({ imagen, contexto: { ...c }, idioma })}
            />
          )}
          {seccion === 'reportes' && (
            <VistaReportes conectado={c.conexionHabitat} pendientes={nucleo.hayPendientesReporte()} enviados={interop.enviados} escaladas={escaladas} />
          )}
        </main>
      </div>

      {seccion !== 'asistente' && <AccesoHigia asistente={asistente} onAbrir={() => ir('asistente')} />}
      <AuraHigia asistente={asistente} />

      {!grabando && (
        <PanelSimulador
          abierto={demoAbierta} amplio={simAmplio} onAmplio={cambiarAmplio} onCerrar={() => alternarDemo(false)}
          sim={sim} nucleo={nucleo} registro={registro} iaConfigurada={ia.configurada} evaDesde={evaDesde} ahora={ahora}
          onPerfil={cambiarPerfil} onContexto={cambiarContexto} onInyectar={inyectar} onDiaNormal={cargarDiaNormal}
          onIniciarEva={iniciarEva} onTerminarEva={terminarEva} onPantallaCompleta={() => setCoberturaCompleta(true)}
        />
      )}
      {!grabando && <BarraReproduccion sim={sim} />}
      {coberturaCompleta && (
        <CoberturaPantallaCompleta estado={nucleo.estadoRiesgosHRP()} enEscenario={sim.reproductor.escenario?.hrp ?? []} onCerrar={() => setCoberturaCompleta(false)} />
      )}
      {grabando && <span className="indicador-grabacion" role="status" aria-label={t('Modo grabación activo (G para salir)')} />}
    </div>
  );
}
