import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SISTEMAS, type EstadoCorporal } from '../core/tipos';
import { ORDEN_SISTEMAS, ORGANOS, ORGANOS_INMUNES, SISTEMAS_ANATOMICOS, type SistemaAnatomico } from './anatomia';
import { FiguraCorporal, ubicarSistema } from './FiguraCorporal';

const estado = Object.fromEntries(SISTEMAS.map((s) => [s, 'sinDatos'])) as EstadoCorporal;

function dibujar(vista: 'frente' | 'espalda', sistema: SistemaAnatomico): string {
  const anterior = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => JSON.stringify({ vista, sistema }), setItem: () => {} } as unknown as Storage;
  try {
    return renderToStaticMarkup(<FiguraCorporal estado={estado} seleccion={null} onSeleccionar={() => {}} />);
  } finally {
    if (anterior === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else globalThis.localStorage = anterior;
  }
}

const CONTORNO = /^M [-\d.]+ [-\d.]+(?: Q [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+)+ Z$/;
const LINEA = /^M [-\d.]+ [-\d.]+(?: (?:L [-\d.]+ [-\d.]+|Q [-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+))+$/;

describe('FiguraCorporal por sistemas', () => {
  for (const vista of ['frente', 'espalda'] as const) {
    for (const sistema of ORDEN_SISTEMAS) {
      it(`dibuja ${sistema} · ${vista}`, () => {
        const html = dibujar(vista, sistema);
        const modo = SISTEMAS_ANATOMICOS[sistema].modo;
        const trazos = [...html.matchAll(/<path(?: class="([^"]+)")? d="([^"]+)"/g)];
        for (const [, clase, d] of trazos) {
          expect(d).not.toMatch(/NaN|undefined|null|Infinity/);
          expect(d).toMatch(clase === 'organo-trazo' ? LINEA : CONTORNO);
        }
        if (modo === 'organos') {
          // Solo los órganos del sistema elegido.
          const ids = (ORGANOS[sistema] ?? []).filter((x) => vista === 'frente' || !x.soloFrente);
          expect(html.match(/class="organo /g)?.length).toBe(ids.length);
          expect(html).not.toContain('class="zona-sistema');
        } else if (modo === 'ilustracion') {
          expect(html).toContain('class="zona-sistema');
          expect(html).toContain('class="tinte');
          expect(html).not.toContain('class="organo ');
        } else {
          // Inmune: métricas en lugar del cuerpo.
          expect(html).not.toContain('class="figura-svg"');
          expect(html).toContain('metricas-inmunes');
          expect(html.match(/class="organo-mini/g)?.length).toBe(ORGANOS_INMUNES.length);
        }
      });
    }
  }

  it('tiene los órganos que faltaban', () => {
    const todos = Object.values(ORGANOS).flat().map((x) => x!.id).concat(ORGANOS_INMUNES.map((x) => x.id));
    for (const id of ['bazo', 'pancreas', 'esofago', 'vesicula', 'vejiga', 'ureteres', 'tiroides', 'medula', 'diafragma', 'laringe', 'aorta', 'timo']) {
      expect(todos).toContain(id);
    }
  });

  it('lleva a la vista que muestra el sistema de salud pedido', () => {
    expect(ubicarSistema('corazon', 'digestivo')).toBe('circulatorio');
    expect(ubicarSistema('pulmones', 'respiratorio')).toBeNull();
    expect(ubicarSistema('inmune', 'nervioso')).toBe('inmune');
    expect(ubicarSistema('huesos', 'respiratorio')).toBe('oseo');
    expect(ubicarSistema('piernas', 'respiratorio')).toBe('muscular');
    expect(ubicarSistema('cuerpo', 'respiratorio')).toBeNull();
  });
});
