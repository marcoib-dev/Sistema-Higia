import { describe, expect, it } from 'vitest';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { interpretar } from './conversacion';
import { NucleoSalud } from './nucleo';
import { ChequeoOrientacion } from './orientacion';
import { REGLAS } from './reglas';
import type { Contexto, Lectura, TipoSensor } from './tipos';

const [MEDICA, NOVATO, PILOTO] = PERFILES;
const T = new Date(2026, 10, 14, 10).getTime(); // noviembre
const HABITAT: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: true, medicoABordo: false, conexionHabitat: false, conexionTierra: false,
  diaMision: 45, transicionGravedad: false,
};
const L = (sensor: TipoSensor, valor: number, t = T): Lectura => ({ sensor, valor, timestamp: t, fuente: 'simulador' });
const nuevo = (perfil = PILOTO, contexto: Partial<Contexto> = {}) => new NucleoSalud(REGLAS, perfil, { ...HABITAT, ...contexto });
const hallazgo = (n: NucleoSalud, id: string) => n.hallazgo(id);

describe('traumatismo craneal', () => {
  it('un impacto fuerte es alerta, con posible incapacidad, región cráneo y los datos usados', () => {
    const n = nuevo(PILOTO, { ubicacion: 'eva' });
    const [m] = n.registrar(L('impactoCabeza', 46), T);
    expect(m.hallazgo).toMatchObject({ riesgoId: 'trauma.craneal', nivel: 'alerta', posibleIncapacidad: true, region: 'craneo' });
    expect(m.hallazgo.datos).toEqual([expect.objectContaining({ sensor: 'impactoCabeza', valor: 46 })]);
    expect(m.texto).toMatch(/casco/); // acción para EVA
    expect(n.estadoRegiones().craneo).toBe('alerta');
  });

  it('un golpe moderado es aviso, y pasa a alerta si después hay desorientación', () => {
    const n = nuevo();
    n.registrar(L('impactoCabeza', 18), T);
    expect(hallazgo(n, 'trauma.craneal')?.nivel).toBe('aviso');
    n.registrar(L('orientacion', 5, T + 60_000), T + 60_000);
    expect(hallazgo(n, 'trauma.craneal')?.nivel).toBe('alerta');
    expect(hallazgo(n, 'trauma.craneal')?.datos?.map((d) => d.sensor)).toEqual(['impactoCabeza', 'orientacion']);
  });
});

describe('desorientación y deterioro cognitivo', () => {
  it('orientación muy baja es alerta; algo baja es aviso', () => {
    expect(nuevo().registrar(L('orientacion', 3), T)[0].hallazgo).toMatchObject({ nivel: 'alerta', titulo: 'Desorientación marcada', sensible: true });
    expect(nuevo().registrar(L('orientacion', 7), T)[0].hallazgo.nivel).toBe('aviso');
    expect(nuevo().registrar(L('orientacion', 10), T)).toHaveLength(0);
  });

  it('compara la prueba cognitiva y el tiempo de reacción con la línea base de la persona', () => {
    const [m] = nuevo(MEDICA).registrar([L('cognicion', 60), L('tiempoReaccion', 300)], T);
    expect(m.hallazgo.nivel).toBe('alerta'); // 90 → 60: −33 %
    const datos = m.hallazgo.datos!;
    expect(datos.find((d) => d.sensor === 'cognicion')).toMatchObject({ valor: 60, lineaBase: 90 });
    expect(datos.find((d) => d.sensor === 'tiempoReaccion')).toMatchObject({ valor: 300, lineaBase: 255 });
  });
});

describe('posibles síntomas psicóticos', () => {
  it('señales claras son alerta sensible y se reportan', () => {
    const [m] = nuevo(NOVATO).registrar(L('marcadoresPsicoticos', 6), T);
    expect(m.hallazgo).toMatchObject({ riesgoId: 'mental.psicosis', nivel: 'alerta', sensible: true, ruta: 'reporte' });
    expect(m.canal).not.toBe('pantallaHabitat');
  });

  it('pocas señales con falta de sueño y estrés alto también son alerta, y usa esos datos', () => {
    const n = nuevo(NOVATO);
    n.registrar([L('horasSueno', 4, T - 2), L('horasSueno', 4.5, T - 1), L('horasSueno', 4, T), L('estres', 82)], T);
    const [m] = n.registrar(L('marcadoresPsicoticos', 4), T);
    expect(m.hallazgo.nivel).toBe('alerta');
    expect(m.hallazgo.datos?.filter((d) => d.sensor === 'horasSueno')).toHaveLength(3);
    expect(m.hallazgo.detalleTecnico).toMatch(/sueño promedio 4.2 h/);
  });

  it('sin señales en la conversación no se evalúa (la falta de sueño sola no es psicosis)', () => {
    const n = nuevo(NOVATO);
    n.registrar([L('horasSueno', 3), L('estres', 90)], T);
    expect(hallazgo(n, 'mental.psicosis')).toBeUndefined();
  });
});

describe('chequeo de orientación', () => {
  it('cuatro aciertos dan 10; respuestas erradas bajan el puntaje', () => {
    const bien = new ChequeoOrientacion(PILOTO, HABITAT, T);
    ['Kai', 'En el hábitat, en la Luna', 'Noviembre', 'Trece'].forEach((r) => bien.responder(r));
    expect([bien.terminado, bien.aciertos, bien.valor]).toEqual([true, 4, 10]);

    const mal = new ChequeoOrientacion(PILOTO, HABITAT, T);
    ['Kai', 'En la Tierra', 'marzo', '13'].forEach((r) => mal.responder(r));
    expect([mal.aciertos, mal.valor]).toEqual([2, 5]);
  });
});

describe('frases (intérprete local)', () => {
  const n = nuevo(NOVATO);
  it('"me golpeé la cabeza" deja una alerta en el cráneo y pide el chequeo de orientación', () => {
    expect(interpretar('me golpeé la cabeza con la escotilla', n, T).acciones).toEqual([
      expect.objectContaining({ tipo: 'emitir_alerta', sistema: 'cerebro', region: 'craneo' }),
      { tipo: 'chequeo_orientacion' },
    ]);
  });
  it('"oigo voces" registra señales de alteración de la percepción', () => {
    expect(interpretar('oigo voces cuando no hay nadie', n, T).lecturas).toEqual([expect.objectContaining({ sensor: 'marcadoresPsicoticos', valor: 6 })]);
    expect(interpretar('oigo voces y me están vigilando', n, T).lecturas[0].valor).toBe(8);
  });
  it('"no sé dónde estoy" inicia el chequeo de orientación', () => {
    expect(interpretar('no sé dónde estoy', n, T).acciones).toEqual([{ tipo: 'chequeo_orientacion' }]);
  });
});
