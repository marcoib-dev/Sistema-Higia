import { describe, expect, it } from 'vitest';
import { ESCENARIOS } from '../adaptadores/simulador/escenarios';
import { REGLAS } from './reglas';
import { IDS_HRP, RIESGOS_HRP } from './riesgosHRP';
import { INFO_SENSOR, SENSORES } from './tipos';

describe('cobertura de los riesgos del HRP', () => {
  it('el catálogo tiene los 18 riesgos (17 del HRP + tromboembolismo)', () => {
    expect(RIESGOS_HRP).toHaveLength(18);
    expect(new Set(IDS_HRP).size).toBe(18);
  });

  it('cada riesgo (salvo "sistemas", que es una garantía de diseño) tiene al menos una regla', () => {
    const cubiertos = new Set(REGLAS.flatMap((r) => r.hrp));
    const sinRegla = IDS_HRP.filter((id) => id !== 'sistemas' && !cubiertos.has(id));
    expect(sinRegla).toEqual([]);
  });

  it('cada riesgo tiene al menos un escenario que lo demuestra', () => {
    const demostrados = new Set(ESCENARIOS.flatMap((e) => e.hrp));
    expect(IDS_HRP.filter((id) => !demostrados.has(id))).toEqual([]);
  });

  it('toda regla tiene fuente y riesgos HRP válidos', () => {
    for (const r of REGLAS) {
      expect(r.fuente.trim(), r.id).not.toBe('');
      expect(r.hrp.length, r.id).toBeGreaterThan(0);
      for (const id of r.hrp) expect(IDS_HRP, r.id).toContain(id);
    }
  });

  it('todo dato del catálogo está completo y lo usa alguna regla', () => {
    const usados = new Set(REGLAS.flatMap((r) => r.sensores));
    for (const s of SENSORES) {
      const i = INFO_SENSOR[s];
      expect(i.nombre && i.unidad && i.categoria, s).toBeTruthy();
      expect(usados.has(s), `${s} no lo usa ninguna regla`).toBe(true);
    }
  });

  it('los escenarios usan riesgos y peligros válidos', () => {
    for (const e of ESCENARIOS) for (const id of e.hrp) expect(IDS_HRP, e.id).toContain(id);
  });

  it('hay 38 reglas y 42 escenarios', () => {
    expect(REGLAS).toHaveLength(38);
    expect(ESCENARIOS).toHaveLength(42);
  });
});
