// AVISO: UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
import { definirRegla, normal, signo } from './util';

export const reglaFrecuenciaCardiaca = definirRegla(
  {
    id: 'cardio.frecuencia', nombre: 'Frecuencia cardíaca', sistema: 'corazon',
    sensores: ['frecuenciaCardiaca'],
    fuente: 'Anexo F: frecuencia cardíaca · Anexo B: adaptaciones cardiovasculares y arritmias',
  },
  (h, p, _ahora, c) => {
    const ult = h.ultima('frecuenciaCardiaca');
    if (!ult) return null;
    const fc = ult.valor;
    const base = p.lineaBase.frecuenciaCardiaca ?? 65;
    // Contexto: en ejercicio o en EVA es esperable un pulso más alto.
    const enEsfuerzo = c.actividad === 'ejercicio' || c.ubicacion === 'eva';
    const margen = c.actividad === 'ejercicio' ? 60 : c.ubicacion === 'eva' ? 30 : 0;
    const maximo = enEsfuerzo ? 170 : 140;
    const detalle = `FC ${fc} lpm (línea base ${base}, ${signo(fc - base)})${enEsfuerzo ? ' · en esfuerzo físico' : ''}`;

    if (fc >= maximo || fc < 40) {
      return {
        nivel: 'alerta', titulo: 'Frecuencia cardíaca fuera de rango', detalleTecnico: detalle,
        resumenSimple: fc < 40 ? 'Tu corazón late demasiado lento.' : 'Tu corazón late muy rápido.',
        accion: 'Detén la actividad y respira lento. Si no baja en 5 minutos, avisa a un compañero.',
        accionPorUbicacion: { eva: 'Detén la tarea y asegura tu arnés. Avisa a tu compañero de EVA.' },
        pasos: [
          'Detén toda actividad y quédate quieto, sentado o sujeto.',
          'Respira lento: cuatro segundos inhalando y seis exhalando, durante dos minutos.',
          'Si sientes dolor en el pecho, falta de aire o mareo, avisa a un compañero de inmediato.',
          'Vuelve a medir el pulso en cinco minutos.',
        ],
        posibleIncapacidad: fc < 40 || fc >= 180,
        ruta: 'reporte', sensible: false,
      };
    }
    if (fc - base >= 30 + margen) {
      return {
        nivel: 'aviso', titulo: 'Frecuencia cardíaca elevada', detalleTecnico: detalle,
        resumenSimple: 'Tu corazón late más rápido de lo habitual para ti.',
        accion: 'Baja el ritmo e hidrátate. Vuelvo a revisar en unos minutos.',
        ruta: 'autogestion', sensible: false,
      };
    }
    if (fc - base >= 15 + margen) {
      return {
        nivel: 'info', titulo: 'Frecuencia cardíaca algo elevada', detalleTecnico: detalle,
        resumenSimple: 'Tu pulso está un poco por encima de lo habitual.',
        accion: '', ruta: 'autogestion', sensible: false,
      };
    }
    return normal('Frecuencia cardíaca', detalle);
  },
);

export const reglaPresionArterial = definirRegla(
  {
    id: 'cardio.presion', nombre: 'Presión arterial', sistema: 'corazon',
    sensores: ['presionSistolica', 'presionDiastolica'],
    fuente: 'Anexo F: presión arterial (riesgo de desmayo) · Anexo B: riesgo cardiovascular',
  },
  (h) => {
    const sis = h.ultima('presionSistolica')?.valor;
    const dia = h.ultima('presionDiastolica')?.valor;
    if (sis === undefined || dia === undefined) return null;
    const detalle = `PA ${sis}/${dia} mmHg`;

    if (sis < 80) {
      return {
        nivel: 'alerta', titulo: 'Presión arterial muy baja', detalleTecnico: detalle,
        resumenSimple: 'Tu presión está muy baja y podrías desmayarte.',
        accion: 'Recuéstate con las piernas elevadas y bebe líquido. Avisa a un compañero.',
        pasos: [
          'Recuéstate de inmediato; en microgravedad, sujétate a una superficie.',
          'Eleva las piernas por encima del nivel del corazón.',
          'Bebe medio litro de agua o de solución con electrolitos.',
          'No te levantes durante 15 minutos y vuelve a medir la presión.',
          'Si pierdes la visión, te confundes o te desmayas, un compañero debe asistirte.',
        ],
        posibleIncapacidad: true,
        ruta: 'reporte', sensible: false,
      };
    }
    if (sis < 90) {
      return {
        nivel: 'aviso', titulo: 'Presión arterial baja', detalleTecnico: detalle,
        resumenSimple: 'Tu presión está baja; podrías marearte al moverte rápido.',
        accion: 'Hidrátate y evita cambios bruscos de postura. Considera usar prendas de compresión.',
        ruta: 'autogestion', sensible: false,
      };
    }
    if (sis >= 160 || dia >= 100) {
      return {
        nivel: 'alerta', titulo: 'Presión arterial muy alta', detalleTecnico: detalle,
        resumenSimple: 'Tu presión está muy alta.',
        accion: 'Descansa sentado 10 minutos y repite la medición. Se notificará al equipo médico.',
        pasos: [
          'Siéntate o sujétate y descansa 10 minutos sin hablar.',
          'Repite la medición.',
          'Si aparece dolor de cabeza intenso, visión borrosa o dolor en el pecho, avisa a un compañero.',
        ],
        ruta: 'reporte', sensible: false,
      };
    }
    if (sis >= 140 || dia >= 90) {
      return {
        nivel: 'aviso', titulo: 'Presión arterial elevada', detalleTecnico: detalle,
        resumenSimple: 'Tu presión está más alta de lo recomendado.',
        accion: 'Descansa y repite la medición en 30 minutos. Reduce el sodio en las próximas comidas.',
        ruta: 'autogestion', sensible: false,
      };
    }
    return normal('Presión arterial', detalle);
  },
);
