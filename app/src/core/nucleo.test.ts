import { describe, expect, it } from 'vitest';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { interpretar } from './conversacion';
import { NucleoSalud, PLAZO_CONFIRMACION_INCAPACIDAD_MS, PLAZO_CONFIRMACION_MS } from './nucleo';
import { REGLAS } from './reglas';
import type { Contexto, Lectura, TipoSensor } from './tipos';

const [MEDICA_VETERANA, NOVATO_PANICO] = PERFILES;
const T = 1_700_000_000_000;
const HABITAT: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: false, medicoABordo: false, conexionHabitat: false, conexionTierra: false,
};
const L = (sensor: TipoSensor, valor: number, t = T): Lectura => ({ sensor, valor, timestamp: t, fuente: 'simulador' });
const nuevo = (perfil = MEDICA_VETERANA, contexto: Partial<Contexto> = {}) =>
  new NucleoSalud(REGLAS, perfil, { ...HABITAT, ...contexto });

describe('canales', () => {
  it('en EVA, el estrés alto llega breve por auricular con la acción del arnés', () => {
    const n = nuevo(NOVATO_PANICO, { ubicacion: 'eva' });
    const [m] = n.registrar(L('estres', 86), T);
    expect(m.canal).toBe('auricular');
    expect(m.voz).toBe(true);
    expect(m.texto).toMatch(/arnés/);
  });

  it('la información sensible nunca va a la pantalla compartida del hábitat', () => {
    const n = nuevo(MEDICA_VETERANA, { pantallaHabitat: true });
    const [m] = n.registrar(L('animo', 2), T);
    expect(m.hallazgo.sensible).toBe(true);
    expect(m.canal).not.toBe('pantallaHabitat');
  });

  it('un aviso en horario de sueño se retiene y se entrega al despertar', () => {
    const n = nuevo(MEDICA_VETERANA, { hora: 3 });
    const [m] = n.registrar([L('presionSistolica', 145), L('presionDiastolica', 88)], T);
    expect(m.diferido).toBe(true);
    const entregados = n.actualizarContexto({ hora: 8 }, T + 1000);
    expect(entregados).toHaveLength(1);
    expect(entregados[0].canal).toBe('pantallaHabitat');
  });

  it('una alerta interrumpe aunque sea de madrugada', () => {
    const n = nuevo(MEDICA_VETERANA, { hora: 3 });
    const [m] = n.registrar(L('spo2', 85), T);
    expect(m.diferido).toBe(false);
    expect(m.interrumpir).toBe(true);
  });
});

describe('modo proactivo', () => {
  it('solo habla cuando cambia el nivel', () => {
    const n = nuevo(MEDICA_VETERANA);
    expect(n.registrar(L('frecuenciaCardiaca', 60), T)).toHaveLength(0); // normal desde el inicio
    expect(n.registrar(L('frecuenciaCardiaca', 95, T + 1), T + 1)).toHaveLength(1); // pasa a aviso
    expect(n.registrar(L('frecuenciaCardiaca', 96, T + 2), T + 2)).toHaveLength(0); // sigue en aviso
  });

  it('al novato se le recuerda; al veterano no', () => {
    const tarde = T + 20 * 60_000;
    const vet = nuevo(MEDICA_VETERANA);
    vet.registrar(L('minutosEjercicio', 10), T);
    expect(vet.tick(tarde)).toHaveLength(0);

    const nov = nuevo(NOVATO_PANICO);
    nov.registrar(L('minutosEjercicio', 10), T);
    const [m] = nov.tick(tarde);
    expect(m.esRecordatorio).toBe(true);
  });
});

describe('personalización', () => {
  it('la médica ve cifras; el novato sin formación, no', () => {
    const med = nuevo(MEDICA_VETERANA).registrar([L('presionSistolica', 86), L('presionDiastolica', 56)], T)[0];
    const nov = nuevo(NOVATO_PANICO).registrar([L('presionSistolica', 86), L('presionDiastolica', 56)], T)[0];
    expect(med.texto).toMatch(/86\/56/);
    expect(nov.texto).not.toMatch(/\d/);
  });

  it('a quien es propenso al pánico no se le nombra el pánico', () => {
    const [m] = nuevo(NOVATO_PANICO).registrar(L('estres', 90), T);
    expect(m.texto.toLowerCase()).not.toMatch(/pánico|estrés/);
  });
});

describe('interoperabilidad y médico a bordo', () => {
  it('sin médico ni conexión, los reportes quedan en cola y se pide avisar a un compañero', () => {
    const n = nuevo(NOVATO_PANICO, { conexionHabitat: false, medicoABordo: false });
    const [m] = n.registrar(L('spo2', 85), T);
    expect(m.reporte).toMatch(/avisa a un compañero/);
    expect(n.hayPendientesReporte()).toBe(1);
  });

  it('con médico a bordo, el reporte va al médico y no hay guía paso a paso', () => {
    const [m] = nuevo(NOVATO_PANICO, { medicoABordo: true }).registrar(L('spo2', 85), T);
    expect(m.reporte).toMatch(/médico de a bordo/);
    expect(m.pasos).toBeUndefined();
  });

  it('sin médico a bordo, quien no tiene formación médica recibe la guía paso a paso', () => {
    const [m] = nuevo(NOVATO_PANICO, { medicoABordo: false }).registrar(L('spo2', 85), T);
    expect(m.pasos?.length).toBeGreaterThan(2);
  });

  it('la médica no recibe la guía paso a paso', () => {
    const [m] = nuevo(MEDICA_VETERANA, { medicoABordo: false }).registrar(L('spo2', 85), T);
    expect(m.pasos).toBeUndefined();
  });
});

describe('confirmación y escalada', () => {
  it('una alerta pide confirmación; si se confirma, no se escala', () => {
    const n = nuevo(NOVATO_PANICO, { companeroCercano: true });
    const [m] = n.registrar([L('presionSistolica', 170), L('presionDiastolica', 105)], T);
    expect(m.requiereConfirmacion).toBe(true);
    n.confirmar(m.id);
    expect(n.verificarConfirmaciones(T + PLAZO_CONFIRMACION_MS + 1)).toHaveLength(0);
  });

  it('sin respuesta, escala al compañero cercano y a la base', () => {
    const n = nuevo(NOVATO_PANICO, { companeroCercano: true, conexionHabitat: true });
    n.registrar([L('presionSistolica', 170), L('presionDiastolica', 105)], T);
    expect(n.verificarConfirmaciones(T + PLAZO_CONFIRMACION_MS - 1)).toHaveLength(0);
    const [e] = n.verificarConfirmaciones(T + PLAZO_CONFIRMACION_MS);
    expect(e.escalamiento?.destinos).toEqual(['Compañero cercano (radio de proximidad)', 'Base más cercana']);
    expect(e.voz).toBe(true);
  });

  it('si hay riesgo de incapacidad (hipoxia), escala antes', () => {
    const n = nuevo(NOVATO_PANICO, { companeroCercano: true });
    n.registrar(L('spo2', 82), T);
    expect(n.verificarConfirmaciones(T + PLAZO_CONFIRMACION_INCAPACIDAD_MS)).toHaveLength(1);
  });

  it('sin nadie al alcance, activa la baliza de emergencia', () => {
    const n = nuevo(NOVATO_PANICO);
    n.registrar(L('spo2', 82), T);
    const [e] = n.verificarConfirmaciones(T + PLAZO_CONFIRMACION_INCAPACIDAD_MS);
    expect(e.escalamiento?.destinos).toEqual(['Baliza de emergencia']);
  });

  it('el retardo con Tierra depende del destino', () => {
    const n = nuevo(NOVATO_PANICO, { conexionTierra: true, destino: 'marte' });
    expect(n.destinosEscalamiento()[0]).toMatch(/3 y 22 min/);
  });
});

describe('contexto en la evaluación', () => {
  it('un pulso de 125 lpm es aviso en reposo pero no en ejercicio', () => {
    const [reposo] = nuevo(NOVATO_PANICO, { actividad: 'reposo' }).registrar(L('frecuenciaCardiaca', 125), T);
    expect(reposo.hallazgo.nivel).toBe('aviso');
    expect(nuevo(NOVATO_PANICO, { actividad: 'ejercicio' }).registrar(L('frecuenciaCardiaca', 125), T)).toHaveLength(0);
  });

  it('una tormenta solar es alerta fuera del hábitat y aviso dentro', () => {
    const n = nuevo(MEDICA_VETERANA);
    n.registrar(L('dosisRadiacion', 120), T);
    const [dentro] = n.actualizarContexto({ climaEspacial: 'tormentaSolar' }, T + 1);
    expect(dentro.hallazgo.nivel).toBe('aviso');
    const [fuera] = n.actualizarContexto({ ubicacion: 'eva' }, T + 2);
    expect(fuera.hallazgo.nivel).toBe('alerta');
    expect(fuera.texto).toMatch(/refugio/);
  });
});

describe('conversación', () => {
  it('"dormí cinco horas" registra una lectura de sueño', () => {
    const r = interpretar('Dormí cinco horas', nuevo(), T);
    expect(r.lecturas).toEqual([{ sensor: 'horasSueno', valor: 5, timestamp: T, fuente: 'voz' }]);
  });

  it('responde la consulta de presión con el último dato', () => {
    const n = nuevo();
    n.registrar([L('presionSistolica', 120), L('presionDiastolica', 80)], T);
    expect(interpretar('¿cómo está mi presión?', n, T).texto).toMatch(/120\/80/);
  });
});
