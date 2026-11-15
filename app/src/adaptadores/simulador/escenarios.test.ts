import { describe, expect, it } from 'vitest';
import { PLAZO_CONFIRMACION_MS } from '../../core/nucleo';
import { ORDEN_NIVEL, type Mensaje } from '../../core/tipos';
import { aplicarPasoLocal, perfilDe, prepararEscenario } from './ejecutor';
import { buscarEscenario, ESCENARIOS, GUION_DEMO } from './escenarios';
import { PERFILES } from './perfiles';

const T0 = new Date(2026, 10, 14, 10, 0, 0).getTime();
const IDS_ORIGINALES = [
  'base', 'eva-estres', 'crisis', 'ejercicio', 'animo', 'sueno', 'hipoxia', 'presion-baja', 'sin-ejercicio',
  'tormenta', 'golpe-cabeza-eva', 'golpe-cabeza-leve', 'desorientacion', 'percepcion', 'madrugada',
];

describe('catálogo de escenarios', () => {
  it('ids únicos y los originales siguen existiendo', () => {
    const ids = ESCENARIOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of IDS_ORIGINALES) expect(ids, id).toContain(id);
  });
  it('el guion apunta a escenarios existentes', () => {
    for (const id of GUION_DEMO) expect(buscarEscenario(id), id).toBeDefined();
  });
  it('cada escenario está bien formado', () => {
    for (const e of ESCENARIOS) {
      expect(e.pasos.length, e.id).toBeGreaterThan(0);
      expect(e.queObservar.length, e.id).toBeGreaterThan(0);
      const tiempos = e.pasos.map((p) => p.enMs);
      expect([...tiempos].sort((a, b) => a - b), e.id).toEqual(tiempos);
      if (e.perfil) expect(PERFILES.some((p) => p.id === e.perfil), e.id).toBe(true);
    }
  });
});

describe('cada escenario produce lo esperado', () => {
  for (const e of ESCENARIOS) {
    it(`${e.id}: ${e.nombre}`, () => {
      const n = prepararEscenario(e, perfilDe(e, PERFILES[0]), T0);
      const mensajes: Mensaje[] = [];
      for (const [i, paso] of e.pasos.entries()) {
        const t = T0 + paso.enMs;
        mensajes.push(...aplicarPasoLocal(n, paso, t));
        for (const x of paso.esperado ?? []) {
          expect(n.hallazgo(x.riesgoId)?.nivel, `${e.id} · paso ${i + 1} (${paso.titulo}) · ${x.riesgoId}`).toBe(x.nivel);
        }
        if (paso.sinHallazgosSobre) {
          const tope = ORDEN_NIVEL[paso.sinHallazgosSobre];
          const sobre = n.hallazgosActuales().filter((h) => ORDEN_NIVEL[h.nivel] > tope).map((h) => `${h.riesgoId}=${h.nivel}`);
          expect(sobre, `${e.id} · paso ${i + 1}`).toEqual([]);
        }
        if (paso.esperaEscalada) {
          const escaladas = n.verificarConfirmaciones(t + PLAZO_CONFIRMACION_MS + 1);
          expect(escaladas.length, `${e.id} · paso ${i + 1}: debe escalar`).toBeGreaterThan(0);
        }
      }
      // Toda alerta que llegó al astronauta trae guía paso a paso (§7.2.4), salvo las que no salen de una regla.
      for (const m of mensajes) {
        const h = m.hallazgo;
        if (h.nivel !== 'alerta' || m.escalamiento || h.riesgoId.startsWith('conversacion.') || h.riesgoId.startsWith('asistente.')) continue;
        expect(h.pasos?.length, `${e.id}: ${h.riesgoId} sin pasos`).toBeGreaterThan(1);
      }
    });
  }
});
