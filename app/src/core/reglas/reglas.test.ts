import { describe, expect, it } from 'vitest';
import { reglaPresionArterial } from './cardiovascular';
import { reglaFiebre, reglaReactivacion } from './inmune';
import { reglaGlucemia } from './metabolismo';
import { conPasosSiAlerta, evaluar, KAI, L, T } from './pruebas';
import { reglaRadiacion } from './radiacion';
import { DIA, HORA } from './util';

describe('inmune.fiebre', () => {
  const r = reglaFiebre;
  it('sin datos no evalúa; 36,8 es normal', () => {
    expect(evaluar(r, [])).toBeNull();
    expect(evaluar(r, [L('temperatura', 36.8)])?.nivel).toBe('normal');
  });
  it('escala por umbrales', () => {
    expect(evaluar(r, [L('temperatura', 37.6)])?.nivel).toBe('info');
    const f = evaluar(r, [L('temperatura', 38.2)])!;
    expect(f.nivel).toBe('aviso');
    expect(f.ruta).toBe('reporte');
    expect(f.accion).toMatch(/distancia|utensilios/);
    expect(conPasosSiAlerta(evaluar(r, [L('temperatura', 39.2)]))?.nivel).toBe('alerta');
  });
  it('fiebre de 38 sostenida más de 24 h es alerta', () => {
    const x = evaluar(r, [L('temperatura', 38.3, T - 26 * HORA), L('temperatura', 38.4, T - 12 * HORA), L('temperatura', 38.1)]);
    expect(conPasosSiAlerta(x)?.nivel).toBe('alerta');
    expect(x?.titulo).toMatch(/no baja/);
  });
  it('en ejercicio tolera medio grado', () => {
    expect(evaluar(r, [L('temperatura', 38.2)], { contexto: { actividad: 'ejercicio' } })?.nivel).toBe('info');
  });
  it('hipotermia es alerta con posible incapacidad', () => {
    const x = conPasosSiAlerta(evaluar(r, [L('temperatura', 34.5)]));
    expect(x?.posibleIncapacidad).toBe(true);
  });
  it('recuerda las alergias del perfil para el antitérmico', () => {
    expect(evaluar(r, [L('temperatura', 39.4)], { perfil: KAI })?.accion).toMatch(/Ibuprofeno/);
  });
  it('lleva sus riesgos HRP', () => {
    expect(evaluar(r, [L('temperatura', 38.2)])?.hrp).toEqual(['inmune', 'microorganismos']);
  });
});

describe('inmune.reactivacion', () => {
  const r = reglaReactivacion;
  const malaSemana = [L('horasSueno', 4.5, T - 2 * DIA), L('horasSueno', 4.5, T - DIA), L('horasSueno', 4.5, T - HORA), L('estres', 78)];
  it('sin síntoma no evalúa aunque haya factores', () => {
    expect(evaluar(r, malaSemana)).toBeNull();
  });
  it('síntoma moderado es aviso; con factores sube a alerta', () => {
    expect(evaluar(r, [L('sxPiel', 4)])?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [...malaSemana, L('sxPiel', 4)]));
    expect(x?.nivel).toBe('alerta');
    expect(x?.detalleTecnico).toMatch(/sueño promedio 4.5 h/);
    expect(x?.region).toBe('cara');
  });
  it('alergia atípica intensa es alerta', () => {
    expect(conPasosSiAlerta(evaluar(r, [L('sxAlergia', 7)]))?.titulo).toMatch(/Alergia/);
  });
});

describe('metabolismo.glucemia', () => {
  const r = reglaGlucemia;
  it('umbrales', () => {
    expect(evaluar(r, [L('glucemia', 95)])?.nivel).toBe('normal');
    expect(evaluar(r, [L('glucemia', 66)])?.nivel).toBe('aviso');
    const hipo = conPasosSiAlerta(evaluar(r, [L('glucemia', 50)]));
    expect(hipo?.nivel).toBe('alerta');
    expect(hipo?.posibleIncapacidad).toBe(true);
    expect(hipo?.pasos?.join(' ')).toMatch(/15 gramos/);
    expect(evaluar(r, [L('glucemia', 200)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('glucemia', 260)]))?.nivel).toBe('alerta');
  });
  it('nombra el antecedente familiar de diabetes', () => {
    expect(evaluar(r, [L('glucemia', 200)], { perfil: KAI })?.detalleTecnico).toMatch(/Diabetes/);
    expect(evaluar(r, [L('glucemia', 200)], { perfil: KAI })?.ruta).toBe('reporte');
  });
  it('la hipoglucemia contraindica la EVA', () => {
    expect(evaluar(r, [L('glucemia', 66)])?.bloquea).toContain('eva');
  });
});

describe('cardio.presion con transición de gravedad', () => {
  const r = reglaPresionArterial;
  const pa = (s: number, d: number) => [L('presionSistolica', s), L('presionDiastolica', d)];
  it('96/60 es normal en vuelo, aviso tras aterrizar', () => {
    expect(evaluar(r, pa(96, 60))?.nivel).toBe('normal');
    const x = evaluar(r, pa(96, 60), { contexto: { transicionGravedad: true } });
    expect(x?.nivel).toBe('aviso');
    expect(x?.accion).toMatch(/compresión/);
  });
  it('presión muy baja contraindica pilotaje y EVA', () => {
    const x = conPasosSiAlerta(evaluar(r, pa(78, 50), { contexto: { transicionGravedad: true } }));
    expect(x?.bloquea).toEqual(expect.arrayContaining(['pilotaje', 'eva']));
    expect(x?.pasos?.join(' ')).toMatch(/compresión/);
  });
});

describe('radiacion.dosis', () => {
  const r = reglaRadiacion;
  it('en la Luna la tasa de alerta es la mitad que en órbita', () => {
    const subida = [L('dosisRadiacion', 100, T - HORA), L('dosisRadiacion', 100.7)];
    expect(evaluar(r, subida, { contexto: { destino: 'orbita' } })?.nivel).toBe('normal');
    const luna = conPasosSiAlerta(evaluar(r, subida, { contexto: { destino: 'luna' } }));
    expect(luna?.nivel).toBe('alerta');
    expect(luna?.bloquea).toContain('eva');
  });
  it('proyecta cuándo se alcanza el límite', () => {
    const serie = [0, 1, 2, 3, 4, 5, 6].map((i) => L('dosisRadiacion', 200 + i * 2, T - (6 - i) * DIA));
    const x = evaluar(r, serie, { contexto: { destino: 'marte', diaMision: 100 } });
    expect(x?.detalleTecnico).toMatch(/alcanzas el límite en 194 días/);
    expect(x?.nivel).toBe('info');
  });
  it('con tormenta activa contraindica la EVA', () => {
    expect(evaluar(r, [L('dosisRadiacion', 100)], { contexto: { climaEspacial: 'tormentaSolar' } })?.bloquea).toEqual(['eva']);
  });
});
