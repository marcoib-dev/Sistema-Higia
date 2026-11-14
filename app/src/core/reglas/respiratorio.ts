// ⚠️ UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
import { definirRegla, normal } from './util';

export const reglaSaturacionOxigeno = definirRegla(
  {
    id: 'pulmones.spo2', nombre: 'Saturación de oxígeno', sistema: 'pulmones',
    sensores: ['spo2'],
    fuente: 'Anexo F: síntomas de hipoxia leve · Anexo G: pulmones / respiración',
  },
  (h) => {
    const v = h.ultima('spo2')?.valor;
    if (v === undefined) return null;
    const detalle = `SpO₂ ${v} %`;
    const accionEva = 'Revisa el suministro de oxígeno del traje y regresa a la esclusa.';

    if (v < 88) {
      return {
        nivel: 'alerta', titulo: 'Oxígeno en sangre muy bajo (posible hipoxia)', detalleTecnico: detalle,
        resumenSimple: 'Te está llegando poco oxígeno. Puedes sentir confusión o dolor de cabeza.',
        accion: 'Detén la actividad, revisa la calidad del aire y avisa a un compañero.',
        accionPorUbicacion: { eva: accionEva },
        pasos: [
          'Detén toda actividad física.',
          'Colócate la máscara o el suministro de oxígeno de emergencia.',
          'Revisa el monitor de calidad del aire del módulo o el suministro del traje.',
          'Si estás en EVA, regresa a la esclusa con tu compañero.',
          'Avisa a alguien antes de que aparezca confusión: puede impedirte pedir ayuda después.',
        ],
        posibleIncapacidad: true,
        ruta: 'reporte', sensible: false,
      };
    }
    if (v < 92) {
      return {
        nivel: 'aviso', titulo: 'Oxígeno en sangre bajo', detalleTecnico: detalle,
        resumenSimple: 'Tu nivel de oxígeno está más bajo de lo normal.',
        accion: 'Reduce el esfuerzo y respira profundo. Si aparece confusión o dolor de cabeza, avisa a un compañero.',
        accionPorUbicacion: { eva: accionEva },
        ruta: 'autogestion', sensible: false,
      };
    }
    if (v < 95) {
      return {
        nivel: 'info', titulo: 'Oxígeno en sangre algo bajo', detalleTecnico: detalle,
        resumenSimple: 'Tu oxígeno está un poco por debajo de lo ideal.',
        accion: '', ruta: 'autogestion', sensible: false,
      };
    }
    return normal('Saturación de oxígeno', detalle);
  },
);
