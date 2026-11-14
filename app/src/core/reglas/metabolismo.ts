// AVISO: UMBRALES PROVISIONALES: validar con el equipo médico y con §7.1.7 y el Anexo F antes de la demo.
// Metabolismo y nutrición: glucemia, ingesta, peso, hidratación y fatiga de menú.
import { definirRegla, normal, ultimaReciente } from './util';

export const GLUCEMIA = { hipoGrave: 54, hipo: 70, hiper: 180, hiperGrave: 250 };

export const reglaGlucemia = definirRegla(
  {
    id: 'metabolismo.glucemia', nombre: 'Glucemia', sistema: 'metabolismo',
    sensores: ['glucemia'],
    fuente: 'Anexo F: glucemia (indicador sugerido por el desafío) · §7.1.7 Alimentación y nutrición',
    hrp: ['nutricion'],
  },
  (h, p, ahora) => {
    const ult = ultimaReciente(h, 'glucemia', ahora, 12);
    if (!ult) return null;
    const g = ult.valor;
    const familiar = p.historiaClinica.antecedentesFamiliares.find((a) => /diabetes/i.test(a));
    const detalle = `Glucemia ${g} mg/dL${familiar ? ` · antecedente familiar: ${familiar}` : ''}`;

    if (g < GLUCEMIA.hipoGrave) {
      return {
        nivel: 'alerta', titulo: 'Azúcar en sangre muy bajo', detalleTecnico: detalle,
        resumenSimple: 'Tu azúcar en sangre está muy bajo: puedes sentir temblor, sudor o confusión.',
        accion: 'Toma ya 15 gramos de azúcar rápida (jugo, tabletas de glucosa) y vuelve a medir en 15 minutos.',
        accionPorUbicacion: { eva: 'Usa la bebida del traje si tiene azúcar y regresa a la esclusa con tu compañero.' },
        pasos: [
          'Detén lo que estás haciendo y sujétate o siéntate.',
          'Toma 15 gramos de azúcar rápida: medio vaso de jugo o 3 tabletas de glucosa.',
          'Espera 15 minutos y vuelve a medir.',
          'Si sigue por debajo de 70, repite los 15 gramos.',
          'Cuando suba, come algo con hidratos y proteína.',
          'Si te confundes o no puedes tragar, un compañero debe asistirte.',
        ],
        posibleIncapacidad: true, ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje', 'ejercicioIntenso'],
      };
    }
    if (g < GLUCEMIA.hipo) {
      return {
        nivel: 'aviso', titulo: 'Azúcar en sangre bajo', detalleTecnico: detalle,
        resumenSimple: 'Tu azúcar en sangre está bajo.',
        accion: 'Come o bebe algo con azúcar ahora (15 gramos) y vuelve a medir en 15 minutos.',
        ruta: 'autogestion', sensible: false, bloquea: ['eva', 'pilotaje'],
      };
    }
    if (g > GLUCEMIA.hiperGrave) {
      return {
        nivel: 'alerta', titulo: 'Azúcar en sangre muy alto', detalleTecnico: detalle,
        resumenSimple: 'Tu azúcar en sangre está muy alto.',
        accion: 'Bebe agua, no hagas esfuerzo y repite la medición en una hora. Se avisará al equipo médico.',
        pasos: [
          'Bebe agua en sorbos: un vaso ahora y otro en media hora.',
          'No hagas ejercicio intenso hasta que baje.',
          'Repite la medición en una hora.',
          'Si aparecen vómitos, mucha sed, respiración rápida o confusión, avisa de inmediato.',
        ],
        ruta: 'reporte', sensible: false, bloquea: ['eva', 'ejercicioIntenso'],
      };
    }
    if (g > GLUCEMIA.hiper) {
      return {
        nivel: 'aviso', titulo: 'Azúcar en sangre alto', detalleTecnico: detalle,
        resumenSimple: 'Tu azúcar en sangre está más alto de lo normal.',
        accion: 'Hidrátate y repite la medición antes de la próxima comida.',
        ruta: familiar ? 'reporte' : 'autogestion', sensible: false,
      };
    }
    return normal('Glucemia', detalle);
  },
);
