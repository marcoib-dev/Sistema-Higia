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
  {
    id: 'tormenta-marte', nombre: 'Tormenta solar en EVA en Marte', categoria: 'radiacion',
    descripcion: 'Fuera de la magnetosfera, la dosis sube rápido durante una EVA, sin enlace con Tierra.',
    hrp: ['radiacion'], peligros: ['radiacion', 'distancia'], nivelMaximo: 'alerta',
    queObservar: ['En Marte el umbral de la tasa es la mitad que en órbita.', 'Sin Tierra, la guía lleva al refugio por su cuenta.'],
    contextoInicial: { destino: 'marte', ubicacion: 'eva', conexionTierra: false, diaMision: 300 },
    pasos: [
      {
        enMs: 0, titulo: 'La dosis sube rápido', narracion: '0,7 mSv en una hora: en órbita no alarmaría, en Marte sí.',
        lecturas: (t, h) => {
          const base = h.ultima('dosisRadiacion')?.valor ?? 250;
          return [L('dosisRadiacion', base, t - 60 * MINUTO), L('dosisRadiacion', base + 0.7, t)];
        },
        esperado: [{ riesgoId: 'radiacion.dosis', nivel: 'alerta' }],
      },
      {
        enMs: 10_000, titulo: 'Se confirma la tormenta', narracion: 'El hábitat declara un evento de partículas solares.',
        contexto: { climaEspacial: 'tormentaSolar' },
        esperado: [{ riesgoId: 'radiacion.dosis', nivel: 'alerta' }],
      },
    ],
  },
];
