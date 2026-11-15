/**
 * REPRODUCTOR DE ESCENARIOS — avanza los pasos en el tiempo. Sin React: el reloj es inyectable
 * para testearlo con tiempo falso. Un paso que "espera la escalada" no avanza solo: lo libera la app
 * cuando Higia escala (o quien presenta, con "siguiente").
 */
import type { Escenario, PasoEscenario } from './escenarios';

export type EstadoReproductor = 'inactivo' | 'reproduciendo' | 'pausado' | 'terminado';
export type Velocidad = 1 | 2 | 4;

export interface Programador {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  ahora(): number;
}

const PROGRAMADOR_REAL: Programador = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  ahora: () => Date.now(),
};

export interface OpcionesReproductor {
  /** Aplica un paso (contexto, lecturas, frase…). */
  aplicarPaso: (paso: PasoEscenario, indice: number, escenario: Escenario) => void;
  /** Avisa cada cambio de estado (para re-renderizar). */
  alCambiar?: (r: Reproductor) => void;
  /** Antes del primer paso: reiniciar el núcleo, aplicar perfil, contexto inicial y precarga. */
  alIniciar?: (escenario: Escenario) => void;
  /** Si devuelve false (p. ej. Higia está hablando), el paso espera un poco, con un tope. */
  puedeAvanzar?: () => boolean;
  programador?: Programador;
  /** Margen antes del primer paso para que la app termine de reiniciarse. */
  retardoInicialMs?: number;
  /** Tope de espera mientras `puedeAvanzar` dé false. */
  topeEsperaMs?: number;
}

export class Reproductor {
  estado: EstadoReproductor = 'inactivo';
  escenario: Escenario | null = null;
  /** Último paso aplicado (−1 antes del primero). */
  indicePaso = -1;
  velocidad: Velocidad = 1;
  /** El paso actual espera la escalada. */
  esperando = false;
  /** Escenarios que siguen (guion de la demo). */
  cola: Escenario[] = [];

  private timer: unknown = null;
  private venceEn = 0;
  private restante = 0;
  private esperaDesde = 0;
  private readonly prog: Programador;

  constructor(private readonly o: OpcionesReproductor) {
    this.prog = o.programador ?? PROGRAMADOR_REAL;
  }

  get paso(): PasoEscenario | undefined {
    return this.escenario?.pasos[this.indicePaso];
  }

  get siguientePaso(): PasoEscenario | undefined {
    return this.escenario?.pasos[this.indicePaso + 1];
  }

  /** Milisegundos (de reloj) hasta el próximo paso; null si no hay o está esperando. */
  get msHastaSiguiente(): number | null {
    if (this.estado === 'pausado') return this.siguientePaso && !this.esperando ? this.restante : null;
    if (this.estado !== 'reproduciendo' || this.timer === null) return null;
    return Math.max(0, this.venceEn - this.prog.ahora());
  }

  /** Empieza un escenario. Con `pausado`, queda listo y avanza con "siguiente" (modo paso a paso). */
  iniciar(e: Escenario, opciones: { pausado?: boolean; cola?: Escenario[] } = {}): void {
    this.limpiar();
    this.escenario = e;
    this.indicePaso = -1;
    this.esperando = false;
    if (opciones.cola) this.cola = [...opciones.cola];
    this.o.alIniciar?.(e);
    const primero = (this.o.retardoInicialMs ?? 0) + (e.pasos[0]?.enMs ?? 0);
    if (opciones.pausado) {
      this.estado = 'pausado';
      this.restante = primero;
      this.notificar();
    } else {
      this.estado = 'reproduciendo';
      this.programar(primero);
    }
  }

  /** Reproduce varios escenarios seguidos; entre uno y otro espera "siguiente". */
  iniciarGuion(lista: Escenario[]): void {
    if (!lista.length) return;
    this.iniciar(lista[0], { cola: lista.slice(1) });
  }

  pausar(): void {
    if (this.estado !== 'reproduciendo') return;
    this.restante = this.timer !== null ? Math.max(0, this.venceEn - this.prog.ahora()) : 0;
    this.limpiar();
    this.estado = 'pausado';
    this.notificar();
  }

  reanudar(): void {
    if (this.estado !== 'pausado') return;
    this.estado = 'reproduciendo';
    if (!this.esperando && this.siguientePaso) this.programar(this.restante);
    else if (!this.siguientePaso) this.terminar();
    else this.notificar();
  }

  /** Salta al próximo paso ya (o al próximo escenario del guion, si este terminó). */
  siguiente(): void {
    if (this.estado === 'terminado') {
      const proximo = this.cola.shift();
      if (proximo) this.iniciar(proximo);
      return;
    }
    if (!this.escenario) return;
    this.limpiar();
    this.esperando = false;
    this.avanzar(false);
  }

  /** La escalada ocurrió: el paso que la esperaba se da por cumplido. */
  liberarEspera(): void {
    if (!this.esperando) return;
    this.esperando = false;
    if (this.estado === 'reproduciendo') this.programarSiguiente(2_000);
    else this.notificar();
  }

  reiniciar(): void {
    if (this.escenario) this.iniciar(this.escenario, { pausado: this.estado === 'pausado' });
  }

  detener(): void {
    this.limpiar();
    this.estado = 'inactivo';
    this.escenario = null;
    this.indicePaso = -1;
    this.esperando = false;
    this.cola = [];
    this.notificar();
  }

  cambiarVelocidad(v: Velocidad): void {
    const anterior = this.velocidad;
    this.velocidad = v;
    if (this.estado === 'reproduciendo' && this.timer !== null) {
      // Lo que faltaba se reescala con la nueva velocidad.
      const falta = Math.max(0, this.venceEn - this.prog.ahora()) * (anterior / v);
      this.limpiar();
      this.programarCrudo(falta);
    } else if (this.estado === 'pausado') {
      this.restante = this.restante * (anterior / v);
    }
    this.notificar();
  }

  // ── interno ──────────────────────────────────────────────────────────

  private avanzar(respetarEspera = true): void {
    const e = this.escenario;
    if (!e) return;
    const proximo = e.pasos[this.indicePaso + 1];
    if (!proximo) { this.terminar(); return; }
    // Si Higia está hablando, se espera a que termine (con tope) para que no se pisen.
    if (respetarEspera && this.o.puedeAvanzar && !this.o.puedeAvanzar()) {
      if (!this.esperaDesde) this.esperaDesde = this.prog.ahora();
      if (this.prog.ahora() - this.esperaDesde < (this.o.topeEsperaMs ?? 8_000)) { this.programarCrudo(500); return; }
    }
    this.esperaDesde = 0;
    this.indicePaso++;
    this.o.aplicarPaso(proximo, this.indicePaso, e);
    if (proximo.esperaEscalada) {
      this.esperando = true;
      this.notificar();
      return;
    }
    if (this.estado === 'reproduciendo') this.programarSiguiente();
    else if (!e.pasos[this.indicePaso + 1]) this.terminar();
    else {
      this.restante = (e.pasos[this.indicePaso + 1].enMs - proximo.enMs) / this.velocidad;
      this.notificar();
    }
  }

  private programarSiguiente(minimo = 0): void {
    const e = this.escenario!;
    const actual = e.pasos[this.indicePaso];
    const proximo = e.pasos[this.indicePaso + 1];
    if (!proximo) { this.terminar(); return; }
    this.programar(Math.max(minimo * this.velocidad, proximo.enMs - (actual?.enMs ?? 0)));
  }

  /** Programa en tiempo de escenario (se divide por la velocidad). */
  private programar(msEscenario: number): void {
    this.programarCrudo(msEscenario / this.velocidad);
  }

  private programarCrudo(ms: number): void {
    this.limpiar();
    this.venceEn = this.prog.ahora() + ms;
    this.timer = this.prog.setTimeout(() => { this.timer = null; this.avanzar(); }, ms);
    this.notificar();
  }

  private terminar(): void {
    this.limpiar();
    this.estado = 'terminado';
    this.notificar();
  }

  private limpiar(): void {
    if (this.timer !== null) this.prog.clearTimeout(this.timer);
    this.timer = null;
  }

  private notificar(): void {
    this.o.alCambiar?.(this);
  }
}
