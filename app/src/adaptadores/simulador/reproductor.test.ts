import { describe, expect, it } from 'vitest';
import type { Escenario } from './escenarios';
import { Reproductor, type Programador } from './reproductor';

/** Reloj falso: los timers corren solo cuando se avanza el tiempo. */
function relojFalso() {
  let ahora = 0;
  let seq = 0;
  const timers = new Map<number, { en: number; fn: () => void }>();
  const prog: Programador = {
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { en: ahora + ms, fn }); return id; },
    clearTimeout: (id) => { timers.delete(id as number); },
    ahora: () => ahora,
  };
  const avanzar = (ms: number) => {
    const fin = ahora + ms;
    for (;;) {
      const prox = [...timers].filter(([, t]) => t.en <= fin).sort((a, b) => a[1].en - b[1].en)[0];
      if (!prox) break;
      timers.delete(prox[0]);
      ahora = prox[1].en;
      prox[1].fn();
    }
    ahora = fin;
  };
  return { prog, avanzar };
}

const ESC: Escenario = {
  id: 'x', nombre: 'X', descripcion: '', categoria: 'sistema', hrp: [], peligros: [], nivelMaximo: 'info', queObservar: [],
  pasos: [
    { enMs: 0, titulo: 'a', narracion: '' },
    { enMs: 1000, titulo: 'b', narracion: '' },
    { enMs: 3000, titulo: 'c', narracion: '' },
  ],
};

function armar(_e = ESC) {
  const reloj = relojFalso();
  const aplicados: string[] = [];
  const iniciados: string[] = [];
  const r = new Reproductor({
    programador: reloj.prog,
    aplicarPaso: (p) => aplicados.push(p.titulo),
    alIniciar: (x) => iniciados.push(x.id),
  });
  return { r, reloj, aplicados, iniciados };
}

describe('reproductor', () => {
  it('aplica los pasos en orden y en su tiempo', () => {
    const { r, reloj, aplicados, iniciados } = armar();
    r.iniciar(ESC);
    expect(iniciados).toEqual(['x']);
    reloj.avanzar(0);
    expect(aplicados).toEqual(['a']);
    reloj.avanzar(999);
    expect(aplicados).toEqual(['a']);
    expect(r.msHastaSiguiente).toBe(1);
    reloj.avanzar(1);
    expect(aplicados).toEqual(['a', 'b']);
    reloj.avanzar(2000);
    expect(aplicados).toEqual(['a', 'b', 'c']);
    expect(r.estado).toBe('terminado');
  });

  it('pausa y reanuda conservando lo que faltaba', () => {
    const { r, reloj, aplicados } = armar();
    r.iniciar(ESC);
    reloj.avanzar(400);
    r.pausar();
    expect(r.estado).toBe('pausado');
    expect(r.msHastaSiguiente).toBe(600);
    reloj.avanzar(10_000);
    expect(aplicados).toEqual(['a']);
    r.reanudar();
    reloj.avanzar(599);
    expect(aplicados).toEqual(['a']);
    reloj.avanzar(1);
    expect(aplicados).toEqual(['a', 'b']);
  });

  it('"siguiente" salta ya, y en pausa funciona paso a paso', () => {
    const { r, aplicados } = armar();
    r.iniciar(ESC, { pausado: true });
    expect(aplicados).toEqual([]);
    r.siguiente();
    r.siguiente();
    expect(aplicados).toEqual(['a', 'b']);
    expect(r.estado).toBe('pausado');
    r.siguiente();
    expect(r.estado).toBe('terminado');
  });

  it('la velocidad acorta las esperas', () => {
    const { r, reloj, aplicados } = armar();
    r.cambiarVelocidad(4);
    r.iniciar(ESC);
    reloj.avanzar(250);
    expect(aplicados).toEqual(['a', 'b']);
    reloj.avanzar(500);
    expect(aplicados).toEqual(['a', 'b', 'c']);
  });

  it('detener a mitad cancela lo pendiente', () => {
    const { r, reloj, aplicados } = armar();
    r.iniciar(ESC);
    reloj.avanzar(500);
    r.detener();
    reloj.avanzar(10_000);
    expect(aplicados).toEqual(['a']);
    expect(r.estado).toBe('inactivo');
  });

  it('un paso que espera la escalada no avanza solo', () => {
    const e: Escenario = { ...ESC, pasos: [{ enMs: 0, titulo: 'a', narracion: '', esperaEscalada: true }, { enMs: 1000, titulo: 'b', narracion: '' }] };
    const { r, reloj, aplicados } = armar(e);
    r.iniciar(e);
    reloj.avanzar(60_000);
    expect(aplicados).toEqual(['a']);
    expect(r.esperando).toBe(true);
    r.liberarEspera();
    reloj.avanzar(2000);
    expect(aplicados).toEqual(['a', 'b']);
  });

  it('espera a que Higia termine de hablar, con tope', () => {
    const reloj = relojFalso();
    const aplicados: string[] = [];
    let hablando = true;
    const r = new Reproductor({ programador: reloj.prog, aplicarPaso: (p) => aplicados.push(p.titulo), puedeAvanzar: () => !hablando, topeEsperaMs: 3000 });
    r.iniciar(ESC);
    reloj.avanzar(2000);
    expect(aplicados).toEqual([]);
    hablando = false;
    reloj.avanzar(500);
    expect(aplicados).toEqual(['a']);
    hablando = true;
    reloj.avanzar(1000 + 3500);
    expect(aplicados).toEqual(['a', 'b']); // pasó el tope
  });

  it('el guion encadena escenarios y espera "siguiente" entre uno y otro', () => {
    const { r, reloj, iniciados } = armar();
    r.iniciarGuion([ESC, { ...ESC, id: 'y' }]);
    reloj.avanzar(5000);
    expect(r.estado).toBe('terminado');
    expect(iniciados).toEqual(['x']);
    r.siguiente();
    expect(iniciados).toEqual(['x', 'y']);
  });
});
