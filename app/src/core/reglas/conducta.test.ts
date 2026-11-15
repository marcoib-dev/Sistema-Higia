import { describe, expect, it } from 'vitest';
import { REGLAS } from '.';
import { reglaAnimoSostenido, reglaCircadiano, reglaCohesion, reglaSobrecarga, reglaSueno } from './mental';
import { conPasosSiAlerta, evaluar, L, T } from './pruebas';
import { DIA, HORA } from './util';

const diaria = (s: Parameters<typeof L>[0], valores: number[]) => valores.map((v, i) => L(s, v, T - (valores.length - 1 - i) * DIA));

describe('mental.animoSostenido', () => {
  const r = reglaAnimoSostenido;
  it('con pocos días no evalúa', () => {
    expect(evaluar(r, diaria('animo', [4, 4, 4]))).toBeNull();
  });
  it('5 de 7 días bajos es aviso; 10 de 14, alerta con reporte', () => {
    expect(evaluar(r, diaria('animo', [7, 7, 7, 7, 7, 7, 7]))?.nivel).toBe('normal');
    const aviso = evaluar(r, diaria('animo', [7, 4, 5, 4, 7, 4, 5]));
    expect(aviso?.nivel).toBe('aviso');
    expect(aviso?.sensible).toBe(true);
    expect(aviso?.textoCalmado).toBeTruthy();
    const alerta = conPasosSiAlerta(evaluar(r, diaria('animo', [4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 7, 4, 4])));
    expect(alerta?.nivel).toBe('alerta');
    expect(alerta?.ruta).toBe('reporte');
  });
  it('sin enlace con Tierra no promete una llamada', () => {
    const dias = diaria('animo', [7, 4, 5, 4, 7, 4, 5]);
    expect(evaluar(r, dias, { contexto: { conexionTierra: false } })?.accion).toMatch(/diario/);
    expect(evaluar(r, dias, { contexto: { conexionTierra: true } })?.accion).toMatch(/psicólogo/);
  });
});

describe('equipo.cohesion', () => {
  const r = reglaCohesion;
  it('umbrales, caída respecto de la base y siempre sensible', () => {
    expect(evaluar(r, [L('cohesionEquipo', 8)])?.nivel).toBe('normal');
    expect(evaluar(r, [L('cohesionEquipo', 5)])?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [L('cohesionEquipo', 3)]));
    expect(x?.nivel).toBe('alerta');
    expect(x?.sensible).toBe(true);
  });
});

describe('sueno.circadiano', () => {
  it('desfase de 2 h aviso; 4 h alerta con bloqueo de pilotaje', () => {
    expect(evaluar(reglaCircadiano, [L('desfaseCircadiano', 1)])?.nivel).toBe('normal');
    expect(evaluar(reglaCircadiano, [L('desfaseCircadiano', 3)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(reglaCircadiano, [L('desfaseCircadiano', 5)]))?.bloquea).toEqual(['pilotaje']);
  });
});

describe('trabajo.sobrecarga', () => {
  const r = reglaSobrecarga;
  it('3 de 5 días largos', () => {
    expect(evaluar(r, diaria('horasTrabajo', [9, 9, 11, 9, 11]))?.nivel).toBe('normal');
    expect(evaluar(r, diaria('horasTrabajo', [11, 9, 11, 9, 11]))?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, diaria('horasTrabajo', [13, 13, 9, 13, 12])))?.nivel).toBe('alerta');
  });
});

describe('sueno.deficit', () => {
  it('con menos de 5 h de promedio contraindica el pilotaje', () => {
    const noches = (h: number) => [L('horasSueno', h, T - 2 * DIA), L('horasSueno', h, T - DIA), L('horasSueno', h, T - HORA)];
    expect(evaluar(reglaSueno, noches(4.5))?.bloquea).toEqual(['pilotaje']);
    expect(evaluar(reglaSueno, noches(5.5))?.bloquea).toBeUndefined();
  });
});

describe('catálogo de reglas', () => {
  it('38 reglas, ids únicos, cada una con fuente y riesgos HRP', () => {
    expect(REGLAS).toHaveLength(38);
    expect(new Set(REGLAS.map((r) => r.id)).size).toBe(REGLAS.length);
    for (const r of REGLAS) {
      expect(r.fuente, r.id).not.toBe('');
      expect(r.hrp.length, r.id).toBeGreaterThan(0);
    }
  });
});
