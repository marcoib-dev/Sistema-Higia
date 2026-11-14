import { describe, expect, it } from 'vitest';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { interpretar } from './conversacion';
import { NucleoSalud } from './nucleo';
import { REGLAS } from './reglas';
import type { Contexto, Lectura, TipoSensor } from './tipos';

const [MEDICA_VETERANA, NOVATO_PANICO] = PERFILES;
const T = 1_700_000_000_000;
const HABITAT: Contexto = {
  ubicacion: 'habitat', hora: 10, pantallaHabitat: true, pantallaPersonal: true,
  auricular: true, conexionHabitat: false, conexionTierra: false,
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

describe('interoperabilidad', () => {
  it('sin conexión, los reportes quedan en cola', () => {
    const n = nuevo(MEDICA_VETERANA, { conexionHabitat: false });
    const [m] = n.registrar(L('spo2', 85), T);
    expect(m.reporte).toMatch(/Sin conexión/);
    expect(n.hayPendientesReporte()).toBe(1);
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
