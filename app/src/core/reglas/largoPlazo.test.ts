import { describe, expect, it } from 'vitest';
import { reglaRuido } from './entorno';
import { reglaMicrobioma } from './inmune';
import { reglaFatigaMenu, reglaHidratacion, reglaIngesta, reglaPeso } from './metabolismo';
import { reglaAdherencia, reglaAptitud, reglaCargaDinamica, reglaHueso } from './musculoesqueletico';
import { ANA, conPasosSiAlerta, evaluar, KAI, L, LUIS, T } from './pruebas';
import { DIA } from './util';

/** Una lectura por día durante `n` días, terminando hoy. */
const diaria = (s: Parameters<typeof L>[0], valores: number[]) => valores.map((v, i) => L(s, v, T - (valores.length - 1 - i) * DIA));

describe('microbioma.entorno', () => {
  const r = reglaMicrobioma;
  it('un valor alto aislado no alarma: importa la tendencia', () => {
    expect(evaluar(r, [L('cargaMicrobiana', 150)])?.nivel).toBe('normal');
  });
  it('subida sostenida es info', () => {
    expect(evaluar(r, diaria('cargaMicrobiana', [20, 40, 70, 110]))?.nivel).toBe('info');
  });
  it('carga alta con síntomas digestivos es aviso; con fiebre, alerta', () => {
    const base = diaria('cargaMicrobiana', [20, 40, 70, 130]);
    expect(evaluar(r, [...base, L('sxDigestivo', 5)])?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [...base, L('sxDigestivo', 5), L('temperatura', 38.4)]));
    expect(x?.nivel).toBe('alerta');
    expect(x?.accion).toMatch(/lote de agua/);
  });
});

describe('nutricion.ingesta', () => {
  const r = reglaIngesta;
  it('compara el promedio de 3 días con el requerimiento del perfil', () => {
    expect(evaluar(r, diaria('caloriasDia', [2700, 2600, 2800]))?.nivel).toBe('normal'); // Luis: 2800
    expect(evaluar(r, diaria('caloriasDia', [2000, 2000, 2000]))?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, diaria('caloriasDia', [1500, 1500, 1500])))?.nivel).toBe('alerta');
  });
  it('sin apetito nombra la fatiga de menú', () => {
    expect(evaluar(r, [...diaria('caloriasDia', [2000, 2000, 2000]), L('sxApetito', 6)])?.resumenSimple).toMatch(/fatiga de menú/);
  });
});

describe('nutricion.peso', () => {
  const r = reglaPeso;
  it('pérdida respecto de la línea base', () => {
    expect(evaluar(r, [L('pesoCorporal', 77)])?.nivel).toBe('normal'); // 78 kg
    expect(evaluar(r, [L('pesoCorporal', 75.5)])?.nivel).toBe('info');
    expect(evaluar(r, [L('pesoCorporal', 73.5)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('pesoCorporal', 70)]))?.nivel).toBe('alerta');
  });
});

describe('nutricion.hidratacion', () => {
  const r = reglaHidratacion;
  it('se evalúa al cierre del día', () => {
    expect(evaluar(r, [L('hidratacion', 800)], { contexto: { hora: 12 } })).toBeNull();
    expect(evaluar(r, [L('hidratacion', 800)], { contexto: { hora: 20 } })?.nivel).toBe('aviso');
    expect(evaluar(r, [L('hidratacion', 1200)], { contexto: { hora: 20 } })?.nivel).toBe('info');
  });
  it('tras un cambio de gravedad el objetivo sube y se evalúa ya', () => {
    const x = evaluar(r, [L('hidratacion', 1400)], { contexto: { hora: 9, transicionGravedad: true } });
    expect(x?.nivel).toBe('aviso');
    expect(x?.accion).toMatch(/presión baja/);
  });
});

describe('nutricion.fatigaMenu', () => {
  const r = reglaFatigaMenu;
  it('promedio bajo es aviso; caída sostenida, info', () => {
    expect(evaluar(r, diaria('aceptabilidadComida', [5, 4, 5]))?.nivel).toBe('aviso');
    expect(evaluar(r, diaria('aceptabilidadComida', [8, 7, 6]))?.nivel).toBe('info');
    expect(evaluar(r, diaria('aceptabilidadComida', [7, 7, 8]))?.nivel).toBe('normal');
  });
});

describe('musculo.adherencia', () => {
  const r = reglaAdherencia;
  it('con pocos días registrados no evalúa', () => {
    expect(evaluar(r, diaria('minutosEjercicio', [95, 95]))).toBeNull();
  });
  it('días que cumplen la meta en la semana', () => {
    expect(evaluar(r, diaria('minutosEjercicio', [95, 95, 95, 95, 95, 95, 95]))?.nivel).toBe('normal');
    expect(evaluar(r, diaria('minutosEjercicio', [95, 95, 30, 95, 95, 40, 95]))?.nivel).toBe('info');
    expect(evaluar(r, diaria('minutosEjercicio', [95, 30, 95, 20, 95, 40, 10]))?.nivel).toBe('aviso');
  });
  it('poca resistencia nombra hueso y músculo', () => {
    const x = evaluar(r, [...diaria('minutosEjercicio', [95, 95, 95, 95, 95, 95, 95]), ...diaria('minutosResistencia', [10, 10, 10])]);
    expect(x?.nivel).toBe('info');
    expect(x?.resumenSimple).toMatch(/huesos y músculos/);
  });
});

describe('musculo.aptitud', () => {
  const r = reglaAptitud;
  it('umbrales del documento (10 % esperable, 20 % más de lo esperable)', () => {
    expect(evaluar(r, [L('fuerza', 95)])?.nivel).toBe('normal'); // Luis: 100
    expect(evaluar(r, [L('fuerza', 88)])?.nivel).toBe('info');
    expect(evaluar(r, [L('fuerza', 78)])?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [L('fuerza', 68)]));
    expect(x?.nivel).toBe('alerta');
    expect(x?.bloquea).toEqual(['eva']);
  });
  it('con varias mediciones cita la tendencia', () => {
    expect(evaluar(r, [L('fuerza', 95, T - 20 * DIA), L('fuerza', 86, T - 10 * DIA), L('fuerza', 78)])?.detalleTecnico).toMatch(/antes 95 → 86/);
  });
});

describe('hueso.perdida', () => {
  const r = reglaHueso;
  it('es una estimación por día de misión y adherencia', () => {
    const x = evaluar(r, [], { contexto: { diaMision: 45 } });
    expect(x?.nivel).toBe('normal');
    expect(x?.detalleTecnico).toMatch(/Estimación: 1.5 %/);
  });
  it('mala adherencia acelera la pérdida', () => {
    const poca = diaria('minutosResistencia', Array(30).fill(10));
    const x = evaluar(r, poca, { contexto: { diaMision: 150 } });
    expect(x?.detalleTecnico).toMatch(/7.5 %/);
    expect(x?.nivel).toBe('info');
    const buena = diaria('minutosResistencia', Array(30).fill(45));
    expect(evaluar(r, buena, { contexto: { diaMision: 150 } })?.nivel).toBe('normal'); // 2,5 %
  });
  it('la osteopenia baja los umbrales y el calcio urinario alto sube un nivel', () => {
    const poca = diaria('minutosResistencia', Array(30).fill(10));
    expect(evaluar(r, poca, { perfil: ANA, contexto: { diaMision: 150 } })?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [...poca, L('calcioUrinario', 290)], { perfil: ANA, contexto: { diaMision: 150 } }));
    expect(x?.nivel).toBe('alerta');
    expect(x?.accion).toMatch(/agua/);
    expect(x?.region).toBe('columna');
  });
  it('en órbita al inicio de la misión, normal', () => {
    expect(evaluar(r, [], { contexto: { destino: 'orbita', diaMision: 5 } })?.nivel).toBe('normal');
  });
});

describe('lesion.cargaDinamica', () => {
  const r = reglaCargaDinamica;
  it('umbrales del pico en 24 h', () => {
    expect(evaluar(r, [L('aceleracionCuerpo', 5)])?.nivel).toBe('normal');
    expect(evaluar(r, [L('aceleracionCuerpo', 9)])?.nivel).toBe('info');
    expect(evaluar(r, [L('aceleracionCuerpo', 14)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('aceleracionCuerpo', 22)]))?.nivel).toBe('alerta');
  });
  it('dolor de espalda después de la carga sube un nivel con pasos de inmovilización', () => {
    const x = conPasosSiAlerta(evaluar(r, [L('aceleracionCuerpo', 14, T - 1000), L('sxDolorEspalda', 5)], { perfil: LUIS }));
    expect(x?.nivel).toBe('alerta');
    expect(x?.pasos?.join(' ')).toMatch(/inmoviliza/);
  });
  it('la pérdida ósea estimada agrava', () => {
    expect(evaluar(r, [L('aceleracionCuerpo', 14)], { perfil: KAI, contexto: { diaMision: 300 } })?.nivel).toBe('alerta');
    expect(evaluar(r, [L('aceleracionCuerpo', 9)], { perfil: ANA })?.nivel).toBe('aviso'); // osteopenia
  });
});

describe('entorno.ruido', () => {
  const r = reglaRuido;
  it('de noche el umbral es más bajo', () => {
    expect(evaluar(r, [L('ruidoCabina', 64)], { contexto: { hora: 3 } })?.nivel).toBe('aviso');
    expect(evaluar(r, [L('ruidoCabina', 55)], { contexto: { hora: 3 } })?.nivel).toBe('info');
    expect(evaluar(r, [L('ruidoCabina', 64)], { contexto: { hora: 12 } })?.nivel).toBe('normal');
    expect(evaluar(r, [L('ruidoCabina', 75)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('ruidoCabina', 88)]))?.nivel).toBe('alerta');
  });
});
