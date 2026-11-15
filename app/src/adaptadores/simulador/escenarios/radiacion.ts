import { L, MINUTO, type Escenario } from './modelo';

/** Escenarios de radiación espacial. */
export const ESCENARIOS_RADIACION: Escenario[] = [
  {
    id: 'tormenta', nombre: 'Tormenta solar', categoria: 'radiacion',
    descripcion: 'Se activa el clima espacial de tormenta y la dosis sube de golpe: debe ir al refugio.',
    hrp: ['radiacion'], peligros: ['radiacion'], nivelMaximo: 'aviso',
    queObservar: ['Dentro del hábitat es aviso; fuera sería alerta.', 'La EVA queda contraindicada.'],
    pasos: [{
      enMs: 0, titulo: 'Evento de partículas solares', narracion: 'El hábitat reporta una tormenta solar y el dosímetro sube.',
      contexto: { climaEspacial: 'tormentaSolar' },
      lecturas: (t, h) => {
        const base = h.ultima('dosisRadiacion')?.valor ?? 120;
        return [L('dosisRadiacion', base, t - 30 * MINUTO), L('dosisRadiacion', base + 2.5, t)];
      },
      esperado: [{ riesgoId: 'radiacion.dosis', nivel: 'aviso' }],
    }],
  },
];
