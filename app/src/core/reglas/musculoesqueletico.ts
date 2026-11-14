// ⚠️ UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
// TODO (línea A / kinesiología): agregar reglas de huesos (pérdida ósea de 1–1,5 %/mes),
// pruebas de fuerza y equilibrio. Ver Anexo G.
import { definirRegla, normal } from './util';

const META_MINUTOS = 90; // 1,5 h/día de resistencia + aeróbico (Anexo F, contramedidas)

export const reglaEjercicio = definirRegla(
  {
    id: 'musculo.ejercicio', nombre: 'Ejercicio diario', sistema: 'musculos',
    sensores: ['minutosEjercicio'],
    fuente: 'Anexo F: contramedida de 1,5 h/día de ejercicio · Anexo G: huesos y músculos',
  },
  (h) => {
    const ult = h.ultima('minutosEjercicio');
    if (!ult) return null;
    const min = ult.valor;
    const detalle = `${min} de ${META_MINUTOS} min de ejercicio hoy`;
    const accion = `Completa tu rutina de resistencia y aeróbico (meta: ${META_MINUTOS} min) para proteger huesos y músculos.`;

    if (min < META_MINUTOS / 2) {
      return {
        nivel: 'aviso', titulo: 'Ejercicio muy por debajo de la meta', detalleTecnico: detalle,
        resumenSimple: 'Hoy llevas muy poco ejercicio; tus huesos y músculos lo necesitan.',
        accion, ruta: 'autogestion', sensible: false,
      };
    }
    if (min < META_MINUTOS) {
      return {
        nivel: 'info', titulo: 'Ejercicio por debajo de la meta', detalleTecnico: detalle,
        resumenSimple: 'Te falta un poco para completar tu ejercicio de hoy.',
        accion, ruta: 'autogestion', sensible: false,
      };
    }
    return normal('Ejercicio', detalle);
  },
);
