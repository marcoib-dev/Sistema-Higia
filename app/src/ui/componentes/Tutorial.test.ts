import { describe, expect, it } from 'vitest';
import { PASOS_TUTORIAL, ubicarBurbuja } from './Tutorial';

const burbuja = { w: 340, h: 180 };

describe('Recorrido guiado', () => {
  it('el primer paso señala el botón del simulador', () => {
    expect(PASOS_TUTORIAL[0].ancla).toBe('simulador');
  });

  it('pone la burbuja debajo de un botón de la barra superior, sin salirse por la derecha', () => {
    const u = ubicarBurbuja({ x: 1300, y: 10, w: 110, h: 36 }, burbuja, 'abajo', 1440, 900);
    expect(u.lado).toBe('abajo');
    expect(u.top).toBe(10 + 36 + 16);
    expect(u.left + burbuja.w).toBeLessThanOrEqual(1440 - 12);
    // La flecha sigue apuntando al centro del botón aunque la burbuja se corra.
    expect(u.left + u.flecha).toBeCloseTo(1355, 0);
  });

  it('cambia al lado opuesto si no cabe en el preferido', () => {
    const u = ubicarBurbuja({ x: 600, y: 800, w: 60, h: 60 }, burbuja, 'abajo', 1440, 900);
    expect(u.lado).toBe('arriba');
    expect(u.top + burbuja.h).toBeLessThanOrEqual(800);
  });

  it('en una barra lateral alta la pone a la derecha y centrada en lo visible', () => {
    const u = ubicarBurbuja({ x: 0, y: 60, w: 220, h: 840 }, burbuja, 'derecha', 1440, 900);
    expect(u.lado).toBe('derecha');
    expect(u.left).toBe(220 + 16);
    expect(u.top).toBeGreaterThanOrEqual(12);
  });
});
