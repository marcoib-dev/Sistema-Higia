/**
 * NÚCLEO AUTÓNOMO — corre completo en el dispositivo, sin conexión.
 * Sensores → reglas → (¿cambió algo?) → personalización → canal → mensaje.
 * Las alertas piden confirmación; si el astronauta no responde, se escala a quien esté disponible.
 */
import { elegirCanal } from './canales';
import { Historial } from './historial';
import { intervaloRecordatorioMs, redactar } from './personalizador';
import {
  ORDEN_NIVEL, RETARDO_TIERRA, SISTEMAS,
  type Contexto, type EstadoCorporal, type Hallazgo, type Lectura, type Mensaje, type Nivel, type Perfil, type Regla,
} from './tipos';

/** Tiempo para responder "Estoy bien" antes de escalar (cortos para la demo). */
export const PLAZO_CONFIRMACION_MS = 30_000;
export const PLAZO_CONFIRMACION_INCAPACIDAD_MS = 15_000;

export class NucleoSalud {
  readonly historial = new Historial();
  private hallazgos = new Map<string, Hallazgo>();
  private emitido = new Map<string, { nivel: Nivel; en: number }>();
  private diferidos: Mensaje[] = [];
  private pendientesReporte: Hallazgo[] = [];
  private porConfirmar = new Map<string, { mensaje: Mensaje; vence: number }>();
  private seq = 0;

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

  /** Reevaluación periódica, para los recordatorios. */
  tick(ahora = Date.now()): Mensaje[] {
    return this.evaluar(this.reglas, ahora);
  }

  /**
   * Cambio de contexto (salir a EVA, despertar, tormenta solar, recuperar conexión…).
   * Reevalúa las reglas, porque el contexto cambia la interpretación, y entrega lo retenido si ya se puede.
   */
  actualizarContexto(cambios: Partial<Contexto>, ahora = Date.now()): Mensaje[] {
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
    return [...salida, ...this.evaluar(this.reglas, ahora).filter((m) => !entregados.has(m.hallazgo.riesgoId))];
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
    const c = this.contexto;
    const d: string[] = [];
    if (c.companeroCercano) d.push('Compañero cercano (radio de proximidad)');
    if (c.medicoABordo && this.perfil.formacionMedica !== 'medico') d.push('Médico de a bordo');
    if (c.conexionHabitat) d.push('Base más cercana');
    if (c.conexionTierra) d.push(`Control en Tierra (retardo de ${RETARDO_TIERRA[c.destino]})`);
    return d;
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
      if (!h) continue;
      this.hallazgos.set(h.riesgoId, h);

      const previo = this.emitido.get(h.riesgoId);
      // Primer dato y todo normal: no hay nada que decir.
      if (!previo && h.nivel === 'normal') {
        this.emitido.set(h.riesgoId, { nivel: h.nivel, en: ahora });
        continue;
      }

      // Modo proactivo: se habla solo si cambió el nivel… o si toca recordatorio según el perfil.
      let esRecordatorio = false;
      if (previo && previo.nivel === h.nivel) {
        const intervalo = intervaloRecordatorioMs(this.perfil);
        const toca = intervalo !== null && ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso && ahora - previo.en >= intervalo;
        if (!toca) continue;
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
      salida.push(m);
    }
    return salida.sort((a, b) => ORDEN_NIVEL[b.hallazgo.nivel] - ORDEN_NIVEL[a.hallazgo.nivel]);
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

  private escalar(h: Hallazgo, ahora: number): Mensaje {
    const destinos = this.destinosEscalamiento();
    const motivo = h.posibleIncapacidad
      ? 'Alerta crítica sin respuesta: el astronauta podría no estar en condiciones de pedir ayuda.'
      : 'Alerta sin respuesta dentro del plazo.';
    if (!this.pendientesReporte.includes(h)) this.pendientesReporte.push(h);

    const texto = destinos.length
      ? `No respondiste a la alerta "${h.titulo}". Avisé a: ${destinos.join(', ')}.`
      : `No respondiste a la alerta "${h.titulo}". No hay nadie al alcance: baliza de emergencia activada; se reintentará al recuperar enlace.`;

    // La escalada siempre interrumpe: por voz si hay auricular, si no por la pantalla disponible.
    const c = this.contexto;
    const canal = c.auricular ? 'auricular' : c.pantallaHabitat && c.ubicacion === 'habitat' ? 'pantallaHabitat' : 'pantallaPersonal';
    return {
      id: `m${++this.seq}`, hallazgo: h, texto, canal, voz: true, interrumpir: true, diferido: false,
      motivo, esRecordatorio: false, requiereConfirmacion: false,
      escalamiento: { destinos: destinos.length ? destinos : ['Baliza de emergencia'], motivo },
      timestamp: ahora,
    };
  }
}
