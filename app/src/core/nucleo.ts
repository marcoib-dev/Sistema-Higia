/**
 * NÚCLEO AUTÓNOMO — corre completo en el dispositivo, sin conexión.
 * Sensores → reglas → (¿cambió algo?) → personalización → canal → mensaje.
 * Las alertas piden confirmación; si el astronauta no responde, se escala a quien esté disponible.
 */
import { elegirCanal } from './canales';
import { Historial } from './historial';
import { intervaloRecordatorioMs, redactar } from './personalizador';
import type { DestinoPedido } from './acciones';
import { IDS_HRP, type IdRiesgoHRP } from './riesgosHRP';
import {
  NOMBRE_DESTINO_COMUNICACION, NOMBRE_SISTEMA, NOMBRE_TAREA, ORDEN_NIVEL, RETARDO_TIERRA, SISTEMAS, TAREAS_CRITICAS, resumenClinico,
  type Comunicacion, type Contexto, type DestinoComunicacion, type EstadoCorporal, type Hallazgo, type Lectura,
  type Mensaje, type Nivel, type Perfil, type RegionCuerpo, type Regla, type SistemaCorporal, type TareaCritica,
} from './tipos';

/** Cómo llega una comunicación a su destino con el contexto actual. */
interface Ruteo {
  destino: DestinoComunicacion;
  destinatario: string;
  estado: 'enviado' | 'enCola';
  retardo?: string;
}

const UBICACION_TEXTO: Record<Contexto['ubicacion'], string> = { habitat: 'en el hábitat', eva: 'en EVA (fuera del hábitat)', rover: 'en el rover' };

/** Tiempo para responder "Estoy bien" antes de escalar (cortos para la demo). */
export const PLAZO_CONFIRMACION_MS = 30_000;
export const PLAZO_CONFIRMACION_INCAPACIDAD_MS = 15_000;
/** Los hallazgos que no salen de una regla (conversación, asistente, tareas) vencen solos. */
export const VENCIMIENTO_HALLAZGO_SUELTO_MS = 24 * 60 * 60_000;

/** Aptitud para cada tarea crítica, con los hallazgos que la contraindican. */
export type AptitudTareas = Record<TareaCritica, { apto: boolean; motivos: Hallazgo[] }>;

/** Hallazgos que no produce una regla: no se reevalúan, caducan por tiempo. */
const esSuelto = (id: string) => id.startsWith('conversacion.') || id.startsWith('asistente.') || id.startsWith('tarea.');

export class NucleoSalud {
  readonly historial = new Historial();
  private hallazgos = new Map<string, Hallazgo>();
  private emitido = new Map<string, { nivel: Nivel; en: number }>();
  private diferidos: Mensaje[] = [];
  private pendientesReporte: Hallazgo[] = [];
  private porConfirmar = new Map<string, { mensaje: Mensaje; vence: number }>();
  private comunicacionesEnviadas: Comunicacion[] = [];
  private seq = 0;
  /** Nombres de los compañeros de tripulación (para dirigir las comunicaciones). */
  companeros: string[] = [];

  constructor(
    private readonly reglas: Regla[],
    public perfil: Perfil,
    public contexto: Contexto,
  ) {}

  /** Punto de entrada de los sensores (o del simulador, o de la voz). */
  registrar(entrada: Lectura | Lectura[], ahora = Date.now()): Mensaje[] {
    const lecturas = Array.isArray(entrada) ? entrada : [entrada];
    lecturas.forEach((l) => this.historial.agregar(l));
    // Solo se evalúan las reglas afectadas: procesamiento liviano (restricción de energía).
    const sensores = new Set(lecturas.map((l) => l.sensor));
    return this.evaluar(this.reglas.filter((r) => r.sensores.some((s) => sensores.has(s))), ahora);
  }

  /**
   * Carga historia sin hablar: registra las lecturas, evalúa todas las reglas y deja los hallazgos
   * como ya comunicados, sin mensajes ni confirmaciones pendientes. Lo usa el simulador para que un
   * escenario empiece con la figura ya coloreada y sin una ráfaga de avisos.
   */
  precargar(lecturas: Lectura[], ahora = Date.now()): void {
    lecturas.forEach((l) => this.historial.agregar(l));
    for (const regla of this.reglas) {
      const h = regla.evaluar(this.historial, this.perfil, ahora, this.contexto);
      if (!h) continue;
      this.hallazgos.set(h.riesgoId, h);
      this.emitido.set(h.riesgoId, { nivel: h.nivel, en: ahora });
    }
  }

  /** Reevaluación periódica, para los recordatorios. */
  tick(ahora = Date.now()): Mensaje[] {
    for (const h of [...this.hallazgos.values()]) {
      if (esSuelto(h.riesgoId) && ahora - h.timestamp >= VENCIMIENTO_HALLAZGO_SUELTO_MS) this.olvidar(h.riesgoId);
    }
    return this.evaluar(this.reglas, ahora);
  }

  /**
   * Cambio de contexto (salir a EVA, despertar, tormenta solar, recuperar conexión…).
   * Reevalúa las reglas, porque el contexto cambia la interpretación, y entrega lo retenido si ya se puede.
   */
  actualizarContexto(cambios: Partial<Contexto>, ahora = Date.now()): Mensaje[] {
    const ubicacionPrevia = this.contexto.ubicacion;
    this.contexto = { ...this.contexto, ...cambios };
    const salida: Mensaje[] = [];
    const siguenRetenidos: Mensaje[] = [];
    for (const d of this.diferidos) {
      const m = this.construirMensaje(d.hallazgo, ahora, false);
      if (m.diferido) siguenRetenidos.push(d);
      else salida.push({ ...m, motivo: `Entregado tras retenerlo. ${m.motivo}` });
    }
    this.diferidos = siguenRetenidos;
    const entregados = new Set(salida.map((m) => m.hallazgo.riesgoId));
    const evaluados = this.evaluar(this.reglas, ahora).filter((m) => !entregados.has(m.hallazgo.riesgoId));
    const tarea = cambios.ubicacion && cambios.ubicacion !== ubicacionPrevia ? this.revisarTarea(ahora) : [];
    return [...salida, ...evaluados, ...tarea];
  }

  /** Cambio de perfil: no altera la detección, solo la entrega. */
  cambiarPerfil(p: Perfil): void {
    this.perfil = p;
  }

  // ── Confirmación y escalada ──────────────────────────────────────────

  /** El astronauta respondió "Estoy bien". */
  confirmar(mensajeId: string): boolean {
    return this.porConfirmar.delete(mensajeId);
  }

  /** Vencimiento de cada alerta que espera confirmación (para mostrar la cuenta regresiva). */
  confirmacionesPendientes(): Map<string, number> {
    return new Map([...this.porConfirmar].map(([id, p]) => [id, p.vence]));
  }

  /** Revisa las alertas sin respuesta. Se llama seguido (cada segundo en la UI). */
  verificarConfirmaciones(ahora = Date.now()): Mensaje[] {
    const salida: Mensaje[] = [];
    for (const [id, { mensaje, vence }] of this.porConfirmar) {
      if (ahora < vence) continue;
      this.porConfirmar.delete(id);
      salida.push(this.escalar(mensaje.hallazgo, ahora));
    }
    return salida;
  }

  /** A quién se puede avisar ahora mismo, del más cercano al más lejano. */
  destinosEscalamiento(): string[] {
    return this.disponibles().map((r) => (r.retardo ? `${r.destinatario} (retardo de ${r.retardo})` : r.destinatario));
  }

  // ── Comunicaciones con otros ─────────────────────────────────────────

  /** Todo lo que Higia envió a otras personas, del más nuevo al más viejo. */
  comunicaciones(): Comunicacion[] {
    return [...this.comunicacionesEnviadas].reverse();
  }

  /** Marca que un destinatario respondió (lo usa el simulador de la tripulación o la red real). */
  registrarRespuesta(id: string, texto: string, ahora = Date.now()): Comunicacion | undefined {
    const c = this.comunicacionesEnviadas.find((x) => x.id === id);
    if (!c) return undefined;
    c.estado = 'respondido';
    c.respuesta = { texto, timestamp: ahora };
    return c;
  }

  /** Al recuperar enlace, lo que estaba en cola sale. Devuelve lo que se envió. */
  reintentarCola(): Comunicacion[] {
    const enviadas: Comunicacion[] = [];
    for (const c of this.comunicacionesEnviadas) {
      if (c.estado !== 'enCola') continue;
      const r = this.rutear(c.destino);
      if (r.estado === 'enviado') {
        c.estado = 'enviado';
        c.retardo = r.retardo;
        enviadas.push(c);
      }
    }
    return enviadas;
  }

  /** Mensaje informativo a otra persona, a pedido del astronauta. */
  enviarMensaje(destino: DestinoPedido, texto: string, ahora = Date.now()): Comunicacion[] {
    return this.comunicar(destino, {
      origen: 'asistente', tipo: 'nota', asunto: `Mensaje de ${this.perfil.nombre}`, texto,
    }, ahora);
  }

  /**
   * El astronauta pide ayuda (por voz o texto). Es una emergencia: se avisa de inmediato
   * a quien corresponda y queda un mensaje de alerta en la app.
   */
  pedirAyuda(destino: DestinoPedido, motivo: string, ahora = Date.now()): Mensaje {
    const c = this.contexto;
    const texto = `${this.perfil.nombre} pide ayuda ${UBICACION_TEXTO[c.ubicacion]}. Motivo: ${motivo} ` +
      `Situación de salud: ${this.situacionActual()} Historia clínica: ${resumenClinico(this.perfil.historiaClinica)}.`;
    const enviadas = this.comunicar(destino, { origen: 'asistente', tipo: 'emergencia', asunto: 'Pedido de ayuda', texto }, ahora);
    const h: Hallazgo = {
      riesgoId: 'asistente.ayuda', sistema: 'cuerpo', nivel: 'alerta', titulo: 'Pedido de ayuda',
      resumenSimple: motivo, detalleTecnico: motivo, accion: 'Mantente en un lugar seguro: la ayuda está avisada.',
      ruta: 'autogestion', sensible: false, fuente: 'Pedido del astronauta al asistente', timestamp: ahora,
    };
    return this.mensajeComunicacion(h, enviadas, 'Pedido del astronauta al asistente.', 'asistente', ahora);
  }

  /**
   * Alerta o aviso surgido de la conversación (un síntoma, un malestar, un riesgo que el astronauta cuenta).
   * Entra al mismo flujo que un hallazgo de sensores: figura del cuerpo, canal, confirmación y escalada.
   */
  alertaDesdeConversacion(
    d: { nivel: Exclude<Nivel, 'normal'>; sistema: SistemaCorporal; titulo: string; detalle: string; region?: RegionCuerpo },
    ahora = Date.now(),
  ): Mensaje[] {
    const accion = d.nivel === 'alerta'
      ? 'Detén lo que estás haciendo y ponte en un lugar seguro. Si no respondes, Higia avisará a otros.'
      : 'Higia lo seguirá de cerca; cuéntale si empeora.';
    const h: Hallazgo = {
      riesgoId: `conversacion.${d.region ?? d.sistema}`, sistema: d.sistema, nivel: d.nivel, titulo: d.titulo, region: d.region,
      resumenSimple: d.detalle, detalleTecnico: `${d.detalle} (reportado por el astronauta)`, accion,
      ruta: d.nivel === 'info' ? 'autogestion' : 'reporte', sensible: d.sistema === 'cerebro',
      fuente: 'Reporte del astronauta en la conversación', timestamp: ahora,
    };
    this.hallazgos.set(h.riesgoId, h);
    const m = this.procesarHallazgo(h, ahora);
    return m ? [m] : [];
  }

  // ── Consultas de estado ──────────────────────────────────────────────

  estadoCorporal(): EstadoCorporal {
    const e = Object.fromEntries(SISTEMAS.map((s) => [s, 'sinDatos'])) as EstadoCorporal;
    for (const h of this.hallazgos.values()) {
      const actual = e[h.sistema];
      if (actual === 'sinDatos' || ORDEN_NIVEL[h.nivel] > ORDEN_NIVEL[actual]) e[h.sistema] = h.nivel;
    }
    return e;
  }

  /** Peor nivel por región del cuerpo (para destacar, p. ej., el cráneo tras un golpe). */
  estadoRegiones(): Partial<Record<RegionCuerpo, Nivel>> {
    const r: Partial<Record<RegionCuerpo, Nivel>> = {};
    for (const h of this.hallazgos.values()) {
      if (!h.region || h.nivel === 'normal') continue;
      const actual = r[h.region];
      if (!actual || ORDEN_NIVEL[h.nivel] > ORDEN_NIVEL[actual]) r[h.region] = h.nivel;
    }
    return r;
  }

  /** Riesgos del HRP: el peor nivel de los hallazgos que responden a cada uno. */
  estadoRiesgosHRP(): Record<IdRiesgoHRP, Nivel | 'sinDatos'> {
    const e = Object.fromEntries(IDS_HRP.map((id) => [id, 'sinDatos'])) as Record<IdRiesgoHRP, Nivel | 'sinDatos'>;
    for (const h of this.hallazgos.values()) {
      for (const id of h.hrp ?? []) {
        const actual = e[id];
        if (actual === 'sinDatos' || ORDEN_NIVEL[h.nivel] > ORDEN_NIVEL[actual]) e[id] = h.nivel;
      }
    }
    return e;
  }

  /** Si cada tarea crítica está contraindicada por algún hallazgo de nivel aviso o superior. */
  aptitudTareas(): AptitudTareas {
    const activos = [...this.hallazgos.values()]
      .filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso && h.bloquea?.length)
      .sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel]);
    return Object.fromEntries(TAREAS_CRITICAS.map((t) => {
      const motivos = activos.filter((h) => h.bloquea!.includes(t));
      return [t, { apto: motivos.length === 0, motivos }];
    })) as AptitudTareas;
  }

  hallazgosActuales(): Hallazgo[] {
    return [...this.hallazgos.values()];
  }

  hallazgo(riesgoId: string): Hallazgo | undefined {
    return this.hallazgos.get(riesgoId);
  }

  /** Lo usa la capa de interoperabilidad cuando hay conexión. Vacía la cola. */
  tomarPendientesReporte(): Hallazgo[] {
    const p = this.pendientesReporte;
    this.pendientesReporte = [];
    return p;
  }

  hayPendientesReporte(): number {
    return this.pendientesReporte.length;
  }

  // ── interno ──────────────────────────────────────────────────────────

  private evaluar(reglas: Regla[], ahora: number): Mensaje[] {
    const salida: Mensaje[] = [];
    for (const regla of reglas) {
      const h = regla.evaluar(this.historial, this.perfil, ahora, this.contexto);
      if (!h) {
        // Sin datos vigentes (p. ej. el golpe ya tiene más de 24 h): el hallazgo viejo caduca.
        if (this.hallazgos.has(regla.id)) this.olvidar(regla.id);
        continue;
      }
      this.hallazgos.set(h.riesgoId, h);
      const m = this.procesarHallazgo(h, ahora);
      if (m) salida.push(m);
    }
    return salida.sort((a, b) => ORDEN_NIVEL[b.hallazgo.nivel] - ORDEN_NIVEL[a.hallazgo.nivel]);
  }

  /** Borra un hallazgo y todo lo que dependía de él (emitido, confirmaciones y mensajes retenidos). */
  private olvidar(riesgoId: string): void {
    this.hallazgos.delete(riesgoId);
    this.emitido.delete(riesgoId);
    for (const [id, p] of this.porConfirmar) if (p.mensaje.hallazgo.riesgoId === riesgoId) this.porConfirmar.delete(id);
    this.diferidos = this.diferidos.filter((d) => d.hallazgo.riesgoId !== riesgoId);
  }

  /**
   * Al cambiar de ubicación: si sale a EVA o sube al rover con un hallazgo que lo contraindica,
   * Higia avisa (no lo impide: la decisión es del astronauta y del equipo). Al volver, el aviso se borra.
   */
  private revisarTarea(ahora: number): Mensaje[] {
    this.olvidar('tarea.eva');
    this.olvidar('tarea.pilotaje');
    const u = this.contexto.ubicacion;
    if (u === 'habitat') return [];
    const tarea: TareaCritica = u === 'eva' ? 'eva' : 'pilotaje';
    const { apto, motivos } = this.aptitudTareas()[tarea];
    if (apto) return [];
    const nombre = NOMBRE_TAREA[tarea].toLowerCase();
    const sensible = motivos.some((m) => m.sensible);
    const h: Hallazgo = {
      riesgoId: `tarea.${tarea}`, sistema: motivos[0].sistema, nivel: 'aviso',
      titulo: tarea === 'eva' ? 'Saliste a EVA con una contraindicación' : 'Pilotaje con una contraindicación',
      resumenSimple: `Hay señales de salud que desaconsejan la ${nombre} ahora mismo.`,
      detalleTecnico: `Contraindicada por: ${motivos.map((m) => `${m.titulo} (${m.nivel})`).join('; ')}`,
      accion: tarea === 'eva'
        ? 'Si puedes, pospón la salida. Si ya estás fuera, quédate cerca de la esclusa y con tu compañero a la vista.'
        : 'Si puedes, deja que otra persona maneje. Si no, ve despacio y evita maniobras bruscas.',
      ruta: 'reporte', sensible, fuente: 'Aptitud para tareas críticas (agrega los hallazgos activos)', timestamp: ahora,
      hrp: [...new Set(motivos.flatMap((m) => m.hrp ?? []))],
      datos: motivos.flatMap((m) => m.datos ?? []),
    };
    this.hallazgos.set(h.riesgoId, h);
    const m = this.procesarHallazgo(h, ahora);
    return m ? [m] : [];
  }

  /** Decide si un hallazgo amerita mensaje y lo prepara (confirmación, reporte, retención). */
  private procesarHallazgo(h: Hallazgo, ahora: number): Mensaje | null {
    const previo = this.emitido.get(h.riesgoId);
    // Primer dato y todo normal: no hay nada que decir.
    if (!previo && h.nivel === 'normal') {
      this.emitido.set(h.riesgoId, { nivel: h.nivel, en: ahora });
      return null;
    }

    // Modo proactivo: se habla solo si cambió el nivel… o si toca recordatorio según el perfil.
    let esRecordatorio = false;
    if (previo && previo.nivel === h.nivel && !h.riesgoId.startsWith('conversacion.')) {
      const intervalo = intervaloRecordatorioMs(this.perfil);
      const toca = intervalo !== null && ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso && ahora - previo.en >= intervalo;
      if (!toca) return null;
      esRecordatorio = true;
    }

    this.emitido.set(h.riesgoId, { nivel: h.nivel, en: ahora });
    // Si el riesgo cambió de nivel, la alerta anterior ya no espera confirmación.
    for (const [id, p] of this.porConfirmar) if (p.mensaje.hallazgo.riesgoId === h.riesgoId) this.porConfirmar.delete(id);

    const m = this.construirMensaje(h, ahora, esRecordatorio);
    if (m.diferido) {
      this.diferidos = [...this.diferidos.filter((d) => d.hallazgo.riesgoId !== h.riesgoId), m];
    }
    if (m.requiereConfirmacion) {
      const plazo = h.posibleIncapacidad ? PLAZO_CONFIRMACION_INCAPACIDAD_MS : PLAZO_CONFIRMACION_MS;
      this.porConfirmar.set(m.id, { mensaje: m, vence: ahora + plazo });
    }
    if (h.ruta === 'reporte' && ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso && !esRecordatorio) {
      this.pendientesReporte.push(h);
    }
    return m;
  }

  /** Cómo llegar a un destino con el contexto actual (directo, por la red del hábitat o en cola). */
  private rutear(destino: DestinoComunicacion): Ruteo {
    const c = this.contexto;
    const companero = this.companeros[0];
    switch (destino) {
      case 'companero': {
        const nombre = companero ? `${companero}, compañero cercano` : NOMBRE_DESTINO_COMUNICACION.companero;
        if (c.companeroCercano) return { destino, destinatario: `${nombre} (radio de proximidad)`, estado: 'enviado' };
        if (c.conexionHabitat) return { destino, destinatario: `${nombre} (por la red del hábitat)`, estado: 'enviado' };
        return { destino, destinatario: nombre, estado: 'enCola' };
      }
      case 'medico':
        if (c.medicoABordo && this.perfil.formacionMedica !== 'medico') return { destino, destinatario: NOMBRE_DESTINO_COMUNICACION.medico, estado: 'enviado' };
        // Sin médico a bordo, el pedido médico va al equipo de la base o a Tierra.
        if (c.conexionHabitat) return { destino: 'base', destinatario: 'Equipo médico de la base', estado: 'enviado' };
        if (c.conexionTierra) return { destino: 'tierra', destinatario: 'Cirujano de vuelo en Tierra', estado: 'enviado', retardo: RETARDO_TIERRA[c.destino] };
        return { destino: 'base', destinatario: 'Equipo médico de la base', estado: 'enCola' };
      case 'base':
        return { destino, destinatario: NOMBRE_DESTINO_COMUNICACION.base, estado: c.conexionHabitat ? 'enviado' : 'enCola' };
      case 'tierra':
        return { destino, destinatario: NOMBRE_DESTINO_COMUNICACION.tierra, estado: c.conexionTierra ? 'enviado' : 'enCola', retardo: RETARDO_TIERRA[c.destino] };
      case 'baliza':
        return { destino, destinatario: NOMBRE_DESTINO_COMUNICACION.baliza, estado: 'enviado' };
    }
  }

  /** Destinos alcanzables ahora mismo, del más cercano al más lejano. */
  private disponibles(): Ruteo[] {
    const c = this.contexto;
    const r: Ruteo[] = [];
    if (c.companeroCercano) r.push(this.rutear('companero'));
    if (c.medicoABordo && this.perfil.formacionMedica !== 'medico') r.push(this.rutear('medico'));
    if (c.conexionHabitat) r.push(this.rutear('base'));
    if (c.conexionTierra) r.push(this.rutear('tierra'));
    return r;
  }

  /** Crea y guarda las comunicaciones hacia un destino (o hacia todos los disponibles). */
  private comunicar(
    destino: DestinoPedido | 'disponibles',
    datos: Pick<Comunicacion, 'origen' | 'tipo' | 'asunto' | 'texto'>,
    ahora: number,
  ): Comunicacion[] {
    let rutas: Ruteo[];
    if (destino === 'todos' || destino === 'disponibles') {
      rutas = this.disponibles();
      // Nadie al alcance: en una emergencia se activa la baliza; una nota espera al compañero.
      if (!rutas.length) rutas = [this.rutear(datos.tipo === 'emergencia' ? 'baliza' : 'companero')];
    } else {
      rutas = [this.rutear(destino)];
    }
    const nuevas = rutas.map((r): Comunicacion => ({
      id: `c${++this.seq}`, destino: r.destino, destinatario: r.destinatario, estado: r.estado, retardo: r.retardo,
      ...datos, timestamp: ahora,
    }));
    this.comunicacionesEnviadas.push(...nuevas);
    return nuevas;
  }

  /** Resumen de una línea de los hallazgos activos, para quien recibe una comunicación. */
  private situacionActual(): string {
    const activos = [...this.hallazgos.values()]
      .filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso)
      .sort((a, b) => ORDEN_NIVEL[b.nivel] - ORDEN_NIVEL[a.nivel]);
    return activos.length ? `${activos.map((h) => `${h.titulo} (${h.detalleTecnico})`).join('; ')}.` : 'sin hallazgos activos.';
  }

  /** Mensaje en la app que deja constancia de una comunicación de emergencia. */
  private mensajeComunicacion(h: Hallazgo, enviadas: Comunicacion[], motivo: string, origen: 'escalada' | 'asistente', ahora: number): Mensaje {
    const enCola = enviadas.filter((c) => c.estado === 'enCola');
    const destinos = enviadas.map((c) => c.destinatario);
    const prefijo = origen === 'asistente' ? 'Pedí ayuda' : `No respondiste a la alerta "${h.titulo}". Avisé`;
    let texto = enviadas.some((c) => c.destino === 'baliza')
      ? `${origen === 'asistente' ? 'Pedí ayuda' : `No respondiste a la alerta "${h.titulo}".`} No hay nadie al alcance: baliza de emergencia activada; se reintentará al recuperar enlace.`
      : `${prefijo} a: ${destinos.join(', ')}.`;
    if (enCola.length && !enviadas.some((c) => c.destino === 'baliza')) texto += ` Sin enlace con ${enCola.map((c) => c.destinatario).join(', ')}: sale al reconectar.`;

    // La comunicación siempre interrumpe: por voz si hay auricular, si no por la pantalla disponible.
    const c = this.contexto;
    const canal = c.auricular ? 'auricular' : c.pantallaHabitat && c.ubicacion === 'habitat' ? 'pantallaHabitat' : 'pantallaPersonal';
    return {
      id: `m${++this.seq}`, hallazgo: h, texto, canal, voz: true, interrumpir: true, diferido: false,
      motivo, esRecordatorio: false, requiereConfirmacion: false,
      escalamiento: { destinos, motivo, origen, comunicaciones: enviadas.map((x) => x.id) },
      timestamp: ahora,
    };
  }

  /** A quién va un reporte que requiere evaluación externa. */
  private destinoReporte(): string {
    const c = this.contexto;
    if (c.medicoABordo && this.perfil.formacionMedica !== 'medico') return 'Se avisará al médico de a bordo.';
    if (c.conexionHabitat) return 'Se enviará al equipo médico de la base.';
    if (c.conexionTierra) return `Se enviará a Tierra (respuesta con retardo de ${RETARDO_TIERRA[c.destino]}).`;
    return 'Sin médico a bordo ni conexión: avisa a un compañero. El reporte se enviará al reconectar.';
  }

  private construirMensaje(h: Hallazgo, ahora: number, esRecordatorio: boolean): Mensaje {
    const d = elegirCanal(h, this.contexto, this.perfil);
    let texto = redactar(h, this.perfil, this.contexto, { breve: d.canal === 'auricular' });
    if (esRecordatorio) texto = `Recordatorio: ${texto}`;

    const esReporte = h.ruta === 'reporte' && ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso;
    // Sin médico a bordo, quien no tiene formación médica recibe una guía paso a paso.
    const conGuia = !!h.pasos && !this.contexto.medicoABordo && this.perfil.formacionMedica !== 'medico';

    return {
      id: `m${++this.seq}`, hallazgo: h, texto, canal: d.canal, voz: d.voz, interrumpir: d.interrumpir,
      diferido: d.diferido, motivo: d.motivo, esRecordatorio,
      reporte: esReporte ? this.destinoReporte() : undefined,
      pasos: conGuia ? h.pasos : undefined,
      requiereConfirmacion: h.nivel === 'alerta' && !esRecordatorio && !d.diferido,
      timestamp: ahora,
    };
  }

  /**
   * Alerta sin respuesta: Higia se comunica con otros. Cada destinatario recibe un mensaje con
   * qué pasó, dónde está el astronauta, sus datos actuales y su historia clínica (alergias, antecedentes).
   */
  private escalar(h: Hallazgo, ahora: number): Mensaje {
    const motivo = h.posibleIncapacidad
      ? 'Alerta crítica sin respuesta: el astronauta podría no estar en condiciones de pedir ayuda.'
      : 'Alerta sin respuesta dentro del plazo.';
    if (!this.pendientesReporte.includes(h)) this.pendientesReporte.push(h);

    const c = this.contexto;
    const texto = `${this.perfil.nombre} no respondió a una alerta de ${NOMBRE_SISTEMA[h.sistema].toLowerCase()}: ${h.titulo} (${h.detalleTecnico}). ` +
      `Está ${UBICACION_TEXTO[c.ubicacion]}. ${h.posibleIncapacidad ? 'Podría no estar en condiciones de responder. ' : ''}` +
      `Otros hallazgos: ${this.situacionActual()} Historia clínica: ${resumenClinico(this.perfil.historiaClinica)}.`;
    const enviadas = this.comunicar('disponibles', { origen: 'escalada', tipo: 'emergencia', asunto: `Alerta sin respuesta: ${h.titulo}`, texto }, ahora);
    return this.mensajeComunicacion(h, enviadas, motivo, 'escalada', ahora);
  }
}
