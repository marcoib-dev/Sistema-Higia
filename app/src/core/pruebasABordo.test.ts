import { describe, expect, it } from 'vitest';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { EvaluacionCognitiva } from './cognicion';
import { interpretar } from './conversacion';
import { horaHabitat } from './momento';
import { NucleoSalud } from './nucleo';
import { elegirPreguntaProactiva, esAfirmativo, esNegativo, preguntaProactiva, primerNumero } from './proactivo';
import { REGLAS } from './reglas';
import type { Contexto, Lectura, TipoSensor } from './tipos';

const [MEDICA, NOVATO] = PERFILES;
const T = new Date(2026, 10, 15, 10, 23).getTime(); // domingo 15 de noviembre de 2026, 10:23
const HABITAT: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: true, medicoABordo: false, conexionHabitat: false, conexionTierra: false,
  diaMision: 45, transicionGravedad: false,
};
const L = (sensor: TipoSensor, valor: number, t = T): Lectura => ({ sensor, valor, timestamp: t, fuente: 'simulador' });
const nuevo = (perfil = NOVATO, contexto: Partial<Contexto> = {}) => new NucleoSalud(REGLAS, perfil, { ...HABITAT, ...contexto });

/** Azar fijo: siempre elige el primer elemento (palabras luna, llave, naranja; dígitos 1…). */
const primero = () => 0;

describe('evaluación cognitiva', () => {
  it('seis preguntas; con todo bien da 100', () => {
    const e = new EvaluacionCognitiva(T, primero);
    expect(e.total).toBe(6);
    expect(e.pregunta()).toMatch(/luna, llave, naranja/);
    e.responder('luna, llave y naranja');
    const digitos = e.pregunta()!.match(/(\d), (\d), (\d), (\d)/)!.slice(1);
    const PALABRA = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    e.responder([...digitos].reverse().map((d) => PALABRA[Number(d)]).join(', ')); // dichos en palabras, uno por uno
    expect(e.pregunta()).toMatch(/Réstale 7 a 100/);
    e.responder('ochenta y seis');
    expect(e.pregunta()).toMatch(/día de la semana/);
    e.responder('domingo');
    expect(e.pregunta()).toMatch(/empieza a las 8 de la mañana y dura 5 horas/);
    e.responder('a la una de la tarde');
    e.responder('luna, naranja y llave');
    expect(e.terminado).toBe(true);
    expect(e.valor).toBe(100);
    expect(e.dominiosConFallas()).toEqual([]);
  });

  it('los errores bajan el puntaje y se informan por dominio', () => {
    const e = new EvaluacionCognitiva(T, primero);
    e.responder('luna y llave'); // 2 de 3
    e.responder('no me acuerdo'); // 0 de 2
    e.responder('93'); // solo el primer paso: 1 de 2
    e.responder('lunes'); // 0 de 1
    e.responder('a las 13'); // 2 de 2
    e.responder('luna'); // 1 de 3
    expect(e.puntos).toBe(6);
    expect(e.valor).toBe(Math.round((6 / 13) * 100));
    expect(e.dominiosConFallas()).toEqual(['memoria inmediata', 'atención', 'cálculo', 'orientación en el tiempo', 'recuerdo diferido']);
  });

  it('el resultado entra como dato "cognicion" y la regla lo compara con la línea base', () => {
    const [m] = nuevo(MEDICA).registrar(L('cognicion', 62), T);
    expect(m.hallazgo).toMatchObject({ riesgoId: 'mental.orientacion', nivel: 'alerta' });
  });
});

describe('preguntas proactivas', () => {
  it('sin datos, primero propone la evaluación cognitiva; luego lo que falta', () => {
    const n = nuevo();
    expect(elegirPreguntaProactiva(n, T, {})?.id).toBe('cognitiva');
    expect(elegirPreguntaProactiva(n, T, { cognitiva: T })?.id).toBe('animo');
    n.registrar([L('animo', 7), L('cognicion', 85)], T);
    expect(elegirPreguntaProactiva(n, T, {})?.id).toBe('sueno');
  });

  it('no pregunta en el horario de sueño ni durante una EVA', () => {
    expect(elegirPreguntaProactiva(nuevo(NOVATO, { hora: 2 }), T, {})).toBeNull();
    expect(elegirPreguntaProactiva(nuevo(NOVATO, { ubicacion: 'eva' }), T, {})).toBeNull();
  });

  it('entiende las respuestas: números en palabras, vasos, sí y no', () => {
    expect(primerNumero('dormí cinco horas y media')).toBe(5.5);
    expect(preguntaProactiva('agua')!.leer!('unos seis vasos')).toBe(1500);
    expect(preguntaProactiva('agua')!.leer!('dos litros')).toBe(2000);
    expect(preguntaProactiva('animo')!.leer!('un siete')).toBe(7);
    expect(esAfirmativo('Sí, claro')).toBe(true);
    expect(esNegativo('ahora no, después')).toBe(true);
    expect(esAfirmativo('no')).toBe(false);
  });
});

describe('fuerza isométrica y maniobra de Valsalva', () => {
  it('compara la prensión con la línea base personal', () => {
    // Línea base de Luis: 46 kg.
    expect(nuevo().registrar(L('fuerzaIsometrica', 44), T)).toHaveLength(0);
    expect(nuevo().registrar(L('fuerzaIsometrica', 40), T)[0].hallazgo.nivel).toBe('info');
    const [m] = nuevo().registrar(L('fuerzaIsometrica', 34.5), T);
    expect(m.hallazgo).toMatchObject({ riesgoId: 'musculo.isometrica', nivel: 'aviso', region: 'brazos' });
    expect(m.hallazgo.datos?.[0]).toMatchObject({ sensor: 'fuerzaIsometrica', valor: 34.5, lineaBase: 46 });
    expect(nuevo().registrar(L('fuerzaIsometrica', 30), T)[0].hallazgo.nivel).toBe('alerta');
  });

  it('un cociente de Valsalva bajo es aviso, y alerta durante una transición de gravedad', () => {
    expect(nuevo().registrar(L('valsalva', 1.5), T)).toHaveLength(0);
    expect(nuevo().registrar(L('valsalva', 1.15), T)[0].hallazgo.nivel).toBe('info');
    expect(nuevo().registrar(L('valsalva', 1.05), T)[0].hallazgo).toMatchObject({ riesgoId: 'cardio.valsalva', nivel: 'aviso', bloquea: ['pilotaje'] });
    const [m] = nuevo(NOVATO, { transicionGravedad: true }).registrar(L('valsalva', 1.05), T);
    expect(m.hallazgo.nivel).toBe('alerta');
    expect(m.hallazgo.pasos?.length).toBeGreaterThan(2);
  });

  it('el intérprete local registra los resultados y abre las pruebas guiadas', () => {
    const n = nuevo();
    expect(interpretar('apreté treinta y ocho kilos en el dinamómetro', n, T).lecturas[0]).toMatchObject({ sensor: 'fuerzaIsometrica', valor: 38 });
    expect(interpretar('el cociente de valsalva dio 1,35', n, T).lecturas[0]).toMatchObject({ sensor: 'valsalva', valor: 1.35 });
    expect(interpretar('quiero hacer la maniobra de valsalva', n, T).acciones).toEqual([{ tipo: 'prueba_guiada', prueba: 'valsalva' }]);
    expect(interpretar('hagamos la prueba de fuerza isométrica', n, T).acciones).toEqual([{ tipo: 'prueba_guiada', prueba: 'isometrica' }]);
    expect(interpretar('hazme una evaluación cognitiva', n, T).acciones).toEqual([{ tipo: 'evaluacion_cognitiva' }]);
  });
});

describe('usa lo que ya sabe del momento', () => {
  it('dice la hora del hábitat, la fecha y el día de misión', () => {
    const n = nuevo();
    expect(horaHabitat(n.contexto, T)).toBe('10:23');
    expect(interpretar('¿Qué hora es?', n, T).texto).toMatch(/10:23/);
    const fecha = interpretar('¿qué día es hoy?', n, T).texto;
    expect(fecha).toMatch(/domingo/);
    expect(fecha).toMatch(/día 45 de la misión/);
    expect(interpretar('¿Hay un médico a bordo?', n, T).texto).toMatch(/no hay médico a bordo/);
    expect(interpretar('¿cómo está el clima espacial?', n, T).texto).toMatch(/calmo/);
  });
});
