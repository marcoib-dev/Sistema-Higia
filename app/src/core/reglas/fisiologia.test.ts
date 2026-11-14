import { describe, expect, it } from 'vitest';
import { reglaArritmia, reglaTrombosis } from './cardiovascular';
import { reglaCargaEva, reglaDescompresion } from './eva';
import { reglaSANS } from './ojos';
import { ANA, conPasosSiAlerta, evaluar, IRENE, KAI, L, T } from './pruebas';
import { reglaHipoxiaCabina, reglaSaturacionOxigeno } from './respiratorio';
import { reglaCinetosis, reglaEquilibrio } from './sensoriomotor';
import { DIA, HORA, MINUTO } from './util';

describe('vestibular.cinetosis', () => {
  const r = reglaCinetosis;
  it('sin síntomas no evalúa; umbrales', () => {
    expect(evaluar(r, [])).toBeNull();
    expect(evaluar(r, [L('sxMareo', 3)])?.nivel).toBe('info');
    expect(evaluar(r, [L('sxNauseas', 5)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('sxMareo', 8)]))?.nivel).toBe('alerta');
  });
  it('en la transición de gravedad explica que es esperable', () => {
    const x = evaluar(r, [L('sxNauseas', 5)], { contexto: { transicionGravedad: true } });
    expect(x?.resumenSimple).toMatch(/mayoría/);
    expect(x?.accion).toMatch(/medicación/);
  });
  it('en EVA un aviso sube a alerta y contraindica la EVA', () => {
    const x = conPasosSiAlerta(evaluar(r, [L('sxNauseas', 5)], { contexto: { ubicacion: 'eva' } }));
    expect(x?.nivel).toBe('alerta');
    expect(x?.accionPorUbicacion?.eva).toMatch(/casco/);
    expect(x?.bloquea).toEqual(['eva', 'pilotaje']);
  });
});

describe('vestibular.equilibrio', () => {
  const r = reglaEquilibrio;
  it('compara contra la línea base', () => {
    expect(evaluar(r, [L('equilibrio', 85)])?.nivel).toBe('normal');
    expect(evaluar(r, [L('equilibrio', 70)])?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [L('equilibrio', 50)]));
    expect(x?.nivel).toBe('alerta');
    expect(x?.bloquea).toContain('pilotaje');
    expect(x?.hrp).toContain('cargasDinamicas');
  });
});

describe('cardio.arritmia', () => {
  const r = reglaArritmia;
  it('umbrales y alerta con taquicardia en reposo', () => {
    expect(evaluar(r, [L('irregularidadRitmo', 2)])?.nivel).toBe('normal');
    expect(evaluar(r, [L('irregularidadRitmo', 6)])?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [L('irregularidadRitmo', 6), L('frecuenciaCardiaca', 124)], { contexto: { actividad: 'reposo' } }));
    expect(x?.nivel).toBe('alerta');
    expect(x?.posibleIncapacidad).toBe(true);
    expect(conPasosSiAlerta(evaluar(r, [L('irregularidadRitmo', 18)]))?.nivel).toBe('alerta');
  });
  it('un antecedente cardiovascular agrava', () => {
    const x = evaluar(r, [L('irregularidadRitmo', 6)], { perfil: KAI });
    expect(x?.nivel).toBe('alerta');
    expect(x?.detalleTecnico).toMatch(/Hipertensión/);
  });
});

describe('vascular.trombosis', () => {
  const r = reglaTrombosis;
  it('grados de flujo yugular', () => {
    expect(evaluar(r, [L('flujoYugular', 1)])?.nivel).toBe('normal');
    expect(evaluar(r, [L('flujoYugular', 2)])?.nivel).toBe('info');
    expect(evaluar(r, [L('flujoYugular', 3)])?.region).toBe('cuello');
    expect(conPasosSiAlerta(evaluar(r, [L('flujoYugular', 4)]))?.nivel).toBe('alerta');
  });
  it('asimetría de pantorrilla con dolor es alerta en la pierna', () => {
    expect(evaluar(r, [L('asimetriaPantorrilla', 2)])?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [L('asimetriaPantorrilla', 2), L('sxDolorPierna', 5)]));
    expect(x?.nivel).toBe('alerta');
    expect(x?.region).toBe('piernas');
  });
  it('con falta de aire, posible embolia con incapacidad', () => {
    const x = conPasosSiAlerta(evaluar(r, [L('flujoYugular', 3), L('sxDisnea', 6)]));
    expect(x?.posibleIncapacidad).toBe(true);
    expect(x?.titulo).toMatch(/falta de aire/);
  });
  it('la falta de aire sola no la evalúa esta regla', () => {
    expect(evaluar(r, [L('sxDisnea', 6)])).toBeNull();
  });
});

describe('descompresion.eva', () => {
  const r = reglaDescompresion;
  it('fuera de la ventana de EVA no evalúa', () => {
    expect(evaluar(r, [L('sxDolorArticular', 6)])).toBeNull();
    expect(evaluar(r, [L('duracionEva', 200, T - 30 * HORA), L('sxDolorArticular', 6)])).toBeNull();
  });
  it('prerrespiración incompleta al salir es aviso', () => {
    const x = evaluar(r, [L('prerrespiracion', 60)], { contexto: { ubicacion: 'eva' } });
    expect(x?.nivel).toBe('aviso');
    expect(x?.titulo).toMatch(/Prerrespiración/);
  });
  it('dolor articular en EVA: aviso y luego alerta con el protocolo textual', () => {
    expect(evaluar(r, [L('sxDolorArticular', 4)], { contexto: { ubicacion: 'eva' } })?.nivel).toBe('aviso');
    const x = conPasosSiAlerta(evaluar(r, [L('sxDolorArticular', 7)], { contexto: { ubicacion: 'eva' } }));
    expect(x?.accionPorUbicacion?.eva).toMatch(/segura pero rápida/);
  });
  it('hormigueo es alerta con posible incapacidad', () => {
    const x = conPasosSiAlerta(evaluar(r, [L('sxNeurologico', 3)], { contexto: { ubicacion: 'eva' } }));
    expect(x?.posibleIncapacidad).toBe(true);
  });
  it('dos horas después de la EVA, en el hábitat, sigue en la ventana', () => {
    const x = evaluar(r, [L('duracionEva', 240, T - 2 * HORA), L('sxDolorArticular', 5)]);
    expect(x?.nivel).toBe('aviso');
    expect(x?.detalleTecnico).toMatch(/2 h después de la EVA/);
  });
});

describe('eva.carga', () => {
  const r = reglaCargaEva;
  const eva = { contexto: { ubicacion: 'eva' as const } };
  it('solo en EVA', () => {
    expect(evaluar(r, [L('duracionEva', 400)])).toBeNull();
  });
  it('duración', () => {
    expect(evaluar(r, [L('duracionEva', 300)], eva)?.nivel).toBe('normal');
    expect(evaluar(r, [L('duracionEva', 380)], eva)?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('duracionEva', 490)], eva))?.nivel).toBe('alerta');
  });
  it('FC sostenida de 150 durante 20 min es sobreesfuerzo', () => {
    const fcs = [22, 15, 8, 0].map((m) => L('frecuenciaCardiaca', 155, T - m * MINUTO));
    expect(evaluar(r, fcs, eva)?.titulo).toMatch(/Sobreesfuerzo/);
    expect(evaluar(r, fcs.slice(2), eva)).toBeNull();
  });
  it('calor en el traje es alerta', () => {
    expect(conPasosSiAlerta(evaluar(r, [L('temperatura', 38.6)], eva))?.titulo).toMatch(/calor/);
  });
});

describe('hipoxia.cabina', () => {
  const r = reglaHipoxiaCabina;
  it('ppO₂ de cabina', () => {
    expect(evaluar(r, [L('ppO2Cabina', 20.5)])?.nivel).toBe('normal');
    expect(evaluar(r, [L('ppO2Cabina', 17.5)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('ppO2Cabina', 15.5)]))?.bloquea).toContain('eva');
  });
  it('un síntoma solo no arma el cuadro', () => {
    expect(evaluar(r, [L('sxCefalea', 5), L('spo2', 93)])).toBeNull();
  });
  it('dos síntomas con oxígeno justo: posible hipoxia leve', () => {
    const noches = [L('horasSueno', 5, T - 2 * DIA), L('horasSueno', 5.5, T - DIA), L('horasSueno', 5, T - HORA)];
    const x = evaluar(r, [...noches, L('sxCefalea', 4), L('spo2', 93), L('spo2', 92, T - HORA)]);
    expect(x?.nivel).toBe('aviso');
    expect(x?.titulo).toBe('Posible hipoxia leve');
    expect(x?.resumenSimple).toMatch(/altura/);
  });
});

describe('pulmones.spo2', () => {
  it('desde aviso contraindica EVA, pilotaje y ejercicio intenso', () => {
    expect(evaluar(reglaSaturacionOxigeno, [L('spo2', 90)])?.bloquea).toEqual(['eva', 'pilotaje', 'ejercicioIntenso']);
    expect(evaluar(reglaSaturacionOxigeno, [L('spo2', 93)])?.bloquea).toBeUndefined();
  });
});

describe('sans.vision', () => {
  const r = reglaSANS;
  it('un síntoma sin pruebas pide hacer la prueba', () => {
    const x = evaluar(r, [L('sxVision', 4)]);
    expect(x?.nivel).toBe('info');
    expect(x?.accion).toMatch(/prueba de visión/);
  });
  it('umbrales de OCT, presión ocular y agudeza', () => {
    expect(evaluar(r, [L('grosorRetina', 25)])?.nivel).toBe('aviso');
    expect(conPasosSiAlerta(evaluar(r, [L('grosorRetina', 55)]))?.nivel).toBe('alerta');
    expect(evaluar(r, [L('presionIntraocular', 24)])?.nivel).toBe('aviso');
    expect(evaluar(r, [L('agudezaVisual', 86)])?.nivel).toBe('aviso'); // línea base 98
    expect(evaluar(r, [L('agudezaVisual', 96)])?.nivel).toBe('normal');
  });
  it('síntoma con prueba alterada sube un nivel y contraindica pilotaje', () => {
    const x = conPasosSiAlerta(evaluar(r, [L('sxVision', 4), L('grosorRetina', 28)]));
    expect(x?.nivel).toBe('alerta');
    expect(x?.bloquea).toEqual(['pilotaje']);
    expect(x?.region).toBe('cara');
  });
  it('nombra el antecedente ocular del perfil', () => {
    expect(evaluar(r, [L('presionIntraocular', 23)], { perfil: IRENE })?.detalleTecnico).toMatch(/límite alto/);
    expect(evaluar(r, [L('presionIntraocular', 23)], { perfil: ANA })?.detalleTecnico).not.toMatch(/antecedente/);
  });
});
