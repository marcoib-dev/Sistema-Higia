import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SISTEMAS, type EstadoCorporal } from '../core/tipos';
import { FiguraCorporal } from './FiguraCorporal';

const estado = Object.fromEntries(SISTEMAS.map((s) => [s, 'sinDatos'])) as EstadoCorporal;

const combinaciones = [
  { vista: 'frente', categoria: 'organos' },
  { vista: 'frente', categoria: 'musculos' },
  { vista: 'frente', categoria: 'huesos' },
  { vista: 'espalda', categoria: 'organos' },
  { vista: 'espalda', categoria: 'musculos' },
  { vista: 'espalda', categoria: 'huesos' },
] as const;

describe('FiguraCorporal', () => {
  for (const { vista, categoria } of combinaciones) {
    it(`dibuja contornos válidos en ${vista} · ${categoria}`, () => {
      const anterior = globalThis.localStorage;
      globalThis.localStorage = {
        getItem: () => JSON.stringify({ vista, categoria }),
        setItem: () => {},
      } as unknown as Storage;
      try {
        const html = renderToStaticMarkup(
          <FiguraCorporal estado={estado} seleccion={null} onSeleccionar={() => {}} />,
        );
        const trazos = [...html.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
        expect(trazos.length).toBeGreaterThan(0);
        for (const d of trazos) {
          expect(d).not.toMatch(/NaN|undefined|null|Infinity/);
          expect(d).toMatch(/^M [-\d.]+ [-\d.]+(?: Q [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+)+ Z$/);
        }
        expect(html).toContain('class="zona-sistema');
        expect(html).toContain('class="tinte');
      } finally {
        if (anterior === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
        else globalThis.localStorage = anterior;
      }
    });
  }
});
