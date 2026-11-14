import { describe, expect, it } from 'vitest';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { enRango, INFO_SENSOR, SENSORES } from './sensores';

describe('catálogo de datos', () => {
  it('cada dato tiene nombre, unidad y un rango válido', () => {
    for (const s of SENSORES) {
      const i = INFO_SENSOR[s];
      expect(i.nombre, s).not.toBe('');
      expect(i.unidad, s).not.toBe('');
      expect(i.min, s).toBeLessThan(i.max);
      expect(i.paso, s).toBeGreaterThan(0);
    }
  });

  it('los síntomas son intensidades 0–10 que se pueden contar hablando', () => {
    for (const s of SENSORES.filter((x) => x.startsWith('sx'))) {
      expect(INFO_SENSOR[s]).toMatchObject({ categoria: 'sintoma', min: 0, max: 10, porVoz: true });
    }
  });

  it('recorta al rango', () => {
    expect(enRango('spo2', 140)).toBe(100);
    expect(enRango('sxMareo', -3)).toBe(0);
  });

  it('las líneas base de los perfiles están dentro del rango de cada dato', () => {
    for (const p of PERFILES) {
      expect(p.requerimientoCalorico).toBeGreaterThan(1000);
      for (const [s, v] of Object.entries(p.lineaBase)) {
        const i = INFO_SENSOR[s as keyof typeof INFO_SENSOR];
        expect(v, `${p.id} ${s}`).toBeGreaterThanOrEqual(i.min);
        expect(v, `${p.id} ${s}`).toBeLessThanOrEqual(i.max);
      }
    }
  });
});
