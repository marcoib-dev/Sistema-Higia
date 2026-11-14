import { describe, expect, it } from 'vitest';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { validarAcciones } from './acciones';
import { interpretar } from './conversacion';
import { NucleoSalud, PLAZO_CONFIRMACION_MS } from './nucleo';
import { REGLAS } from './reglas';
import type { Contexto, Lectura, TipoSensor } from './tipos';

const [MEDICA, NOVATO, PILOTO] = PERFILES;
const T = 1_700_000_000_000;
const HABITAT: Contexto = {
  ubicacion: 'habitat', destino: 'luna', actividad: 'trabajo', climaEspacial: 'calmo', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  companeroCercano: false, medicoABordo: false, conexionHabitat: false, conexionTierra: false,
  diaMision: 45, transicionGravedad: false,
};
const L = (sensor: TipoSensor, valor: number, t = T): Lectura => ({ sensor, valor, timestamp: t, fuente: 'simulador' });
const nuevo = (perfil = NOVATO, contexto: Partial<Contexto> = {}) => {
  const n = new NucleoSalud(REGLAS, perfil, { ...HABITAT, ...contexto });
  n.companeros = ['Kai Tanaka'];
  return n;
};

describe('comunicación con otros tras falta de respuesta', () => {
  it('cada destinatario recibe un mensaje con la situación y la historia clínica', () => {
    const n = nuevo(PILOTO, { companeroCercano: true, conexionTierra: true });
    n.registrar([L('presionSistolica', 170), L('presionDiastolica', 105)], T);
    const [e] = n.verificarConfirmaciones(T + PLAZO_CONFIRMACION_MS);
    const com = n.comunicaciones();
    expect(com.map((c) => c.destino).sort()).toEqual(['companero', 'tierra']);
    expect(e.escalamiento?.comunicaciones).toHaveLength(2);
    const alCompanero = com.find((c) => c.destino === 'companero')!;
    expect(alCompanero.destinatario).toMatch(/Kai Tanaka/);
    expect(alCompanero.tipo).toBe('emergencia');
    expect(alCompanero.texto).toMatch(/Ibuprofeno/); // alergias del piloto
    expect(alCompanero.texto).toMatch(/Hipertensión/);
    expect(com.find((c) => c.destino === 'tierra')!.retardo).toBe('~1,3 s');
  });

  it('sin nadie al alcance activa la baliza', () => {
    const n = nuevo();
    n.registrar([L('presionSistolica', 170), L('presionDiastolica', 105)], T);
    n.verificarConfirmaciones(T + PLAZO_CONFIRMACION_MS);
    expect(n.comunicaciones().map((c) => c.destino)).toEqual(['baliza']);
  });

  it('lo que quedó en cola sale al recuperar el enlace', () => {
    const n = nuevo();
    n.enviarMensaje('tierra', 'Terminé la reparación.', T);
    expect(n.comunicaciones()[0].estado).toBe('enCola');
    n.actualizarContexto({ conexionTierra: true }, T + 1);
    expect(n.reintentarCola()).toHaveLength(1);
    expect(n.comunicaciones()[0].estado).toBe('enviado');
  });
});

describe('acciones del asistente', () => {
  it('pedir ayuda crea un mensaje de alerta y comunicaciones de emergencia', () => {
    const n = nuevo(NOVATO, { companeroCercano: true, conexionHabitat: true });
    const m = n.pedirAyuda('todos', 'Me siento muy mal.', T);
    expect(m.hallazgo.nivel).toBe('alerta');
    expect(m.escalamiento?.origen).toBe('asistente');
    expect(n.comunicaciones()).toHaveLength(2);
  });

  it('sin médico a bordo, el pedido al médico va al equipo de la base', () => {
    const n = nuevo(NOVATO, { conexionHabitat: true });
    const [c] = n.enviarMensaje('medico', 'Consulta', T);
    expect(c.destino).toBe('base');
    expect(c.destinatario).toMatch(/médico de la base/);
  });

  it('una alerta surgida de la conversación entra al flujo normal (figura y confirmación)', () => {
    const n = nuevo();
    const [m] = n.alertaDesdeConversacion({ nivel: 'alerta', sistema: 'corazon', titulo: 'Dolor en el pecho', detalle: 'Dolor opresivo.' }, T);
    expect(m.requiereConfirmacion).toBe(true);
    expect(n.estadoCorporal().corazon).toBe('alerta');
  });

  it('valida y descarta acciones que no entiende', () => {
    const v = validarAcciones([
      { tipo: 'pedir_ayuda', destino: 'tierra', motivo: 'x' },
      { tipo: 'borrar_todo' },
      { tipo: 'ir_a', seccion: 'inexistente' },
      { tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'corazon', titulo: 'Dolor', detalle: 'Dolor en el pecho' },
    ]);
    expect(v.map((a) => a.tipo)).toEqual(['pedir_ayuda', 'emitir_alerta']);
  });
});

describe('intérprete local (sin IA)', () => {
  const n = nuevo(MEDICA);
  const acciones = (f: string) => interpretar(f, n, T).acciones;

  it('"Higia, pide ayuda" pide ayuda a todos', () => {
    expect(acciones('pide ayuda')).toEqual([expect.objectContaining({ tipo: 'pedir_ayuda', destino: 'todos' })]);
  });
  it('dirige la ayuda o el mensaje al destino nombrado', () => {
    expect(acciones('necesito ayuda, llama a la base')[0]).toMatchObject({ tipo: 'pedir_ayuda', destino: 'base' });
    expect(acciones('dile a Tierra que terminé la reparación')[0]).toMatchObject({ tipo: 'enviar_mensaje', destino: 'tierra', mensaje: 'terminé la reparación' });
    expect(acciones('avísale a Kai que voy para allá')[0]).toMatchObject({ tipo: 'enviar_mensaje', destino: 'companero' });
  });
  it('pedido de ayuda con síntoma: pide ayuda y deja la alerta', () => {
    expect(acciones('me duele el pecho, pide ayuda').map((a) => a.tipo)).toEqual(['pedir_ayuda', 'emitir_alerta']);
  });
  it('convierte un síntoma en alerta', () => {
    expect(acciones('me duele el pecho')[0]).toMatchObject({ tipo: 'emitir_alerta', nivel: 'alerta', sistema: 'corazon' });
    expect(acciones('estoy mareado')[0]).toMatchObject({ tipo: 'emitir_alerta', nivel: 'aviso', sistema: 'oidoInterno' });
  });
  it('entiende "estoy bien" y la navegación', () => {
    expect(acciones('estoy bien')).toEqual([{ tipo: 'confirmar_bien' }]);
    expect(acciones('abre mi historia clínica')).toEqual([{ tipo: 'ir_a', seccion: 'perfil' }]);
    expect(acciones('ve a mensajes')).toEqual([{ tipo: 'ir_a', seccion: 'mensajes' }]);
  });
  it('no confunde "¿me ayudas a entender?" con una emergencia', () => {
    expect(acciones('me ayudas a entender mi sueño')).toEqual([]);
  });
});
