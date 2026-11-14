/**
 * NÚCLEO AUTÓNOMO — corre completo en el dispositivo, sin conexión.
 * Sensores → reglas → (¿cambió algo?) → personalización → canal → mensaje.
 */
import { elegirCanal } from './canales';
import { Historial } from './historial';
import { intervaloRecordatorioMs, redactar } from './personalizador';
import {
  ORDEN_NIVEL, SISTEMAS,
  type Contexto, type EstadoCorporal, type Hallazgo, type Lectura, type Mensaje, type Nivel, type Perfil, type Regla,
} from './tipos';

export class NucleoSalud {
  readonly historial = new Historial();
  private hallazgos = new Map<string, Hallazgo>();
  private emitido = new Map<string, { nivel: Nivel; en: number }>();
  private diferidos: Mensaje[] = [];
  private pendientesReporte: Hallazgo[] = [];
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

  /** Cambio de contexto (salir a EVA, despertar, recuperar conexión…): entrega lo retenido si ya se puede. */
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
    return salida;
  }

  /** Cambio de perfil: no altera la detección, solo la entrega. */
  cambiarPerfil(p: Perfil): void {
    this.perfil = p;
  }

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
      const h = regla.evaluar(this.historial, this.perfil, ahora);
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
      const m = this.construirMensaje(h, ahora, esRecordatorio);
      if (m.diferido) {
        this.diferidos = [...this.diferidos.filter((d) => d.hallazgo.riesgoId !== h.riesgoId), m];
      }
      if (h.ruta === 'reporte' && ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso && !esRecordatorio) {
        this.pendientesReporte.push(h);
      }
      salida.push(m);
    }
    return salida.sort((a, b) => ORDEN_NIVEL[b.hallazgo.nivel] - ORDEN_NIVEL[a.hallazgo.nivel]);
  }

  private construirMensaje(h: Hallazgo, ahora: number, esRecordatorio: boolean): Mensaje {
    const d = elegirCanal(h, this.contexto, this.perfil);
    let texto = redactar(h, this.perfil, this.contexto, { breve: d.canal === 'auricular' });
    if (esRecordatorio) texto = `Recordatorio: ${texto}`;

    let reporte: string | undefined;
    if (h.ruta === 'reporte' && ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso) {
      reporte = this.contexto.conexionHabitat
        ? 'Se enviará al equipo médico del hábitat.'
        : 'Sin conexión: avisa a un compañero. El reporte se enviará al reconectar.';
    }

    return {
      id: `m${++this.seq}`, hallazgo: h, texto, canal: d.canal, voz: d.voz, interrumpir: d.interrumpir,
      diferido: d.diferido, motivo: d.motivo, esRecordatorio, reporte, timestamp: ahora,
    };
  }
}
