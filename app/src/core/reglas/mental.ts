// AVISO: UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
// Salud mental: todo hallazgo es `sensible`, así que nunca va a una pantalla compartida.
import { promedio } from '../historial';
import { definirRegla, normal, r1 } from './util';

export const reglaSueno = definirRegla(
  {
    id: 'sueno.deficit', nombre: 'Déficit de sueño', sistema: 'cerebro',
    sensores: ['horasSueno'],
    fuente: 'Anexo F: horas de sueño, actigrafía · Anexo B: sueño y ritmo circadiano',
  },
  (h) => {
    const noches = h.ultimas('horasSueno', 3);
    if (!noches.length) return null;
    const media = r1(promedio(noches.map((n) => n.valor)));
    const detalle = `Promedio de ${media} h en las últimas ${noches.length} noches`;
    const accion = 'Esta noche: luz tenue una hora antes de dormir, nada de cafeína después del mediodía y mantén tu horario.';

    if (media < 6) {
      return {
        nivel: 'aviso', titulo: 'Déficit de sueño acumulado', detalleTecnico: detalle,
        resumenSimple: 'Estás durmiendo bastante menos de lo que necesitas.',
        accion, ruta: 'autogestion', sensible: false,
      };
    }
    if (media < 7) {
      return {
        nivel: 'info', titulo: 'Sueño algo corto', detalleTecnico: detalle,
        resumenSimple: 'Has dormido un poco menos de lo ideal.',
        accion, ruta: 'autogestion', sensible: false,
      };
    }
    return normal('Sueño', detalle);
  },
);

export const reglaAnimo = definirRegla(
  {
    id: 'mental.animo', nombre: 'Estado de ánimo', sistema: 'cerebro',
    sensores: ['animo'],
    fuente: 'Anexo F: encuestas de ánimo · Anexo B: salud conductual por aislamiento y confinamiento',
  },
  (h, p) => {
    const ult = h.ultima('animo');
    if (!ult) return null;
    const base = p.lineaBase.animo ?? 7;
    const caida = base - ult.valor;
    const detalle = `Ánimo ${ult.valor}/10 (línea base ${base})`;

    if (caida >= 4) {
      return {
        nivel: 'alerta', titulo: 'Descenso marcado del ánimo', detalleTecnico: detalle,
        resumenSimple: 'Tu ánimo está bastante más bajo que de costumbre.',
        textoCalmado: 'Parece que estos días están siendo pesados.',
        accion: 'Considera hablar con el psicólogo de la misión o con alguien de confianza. Tú decides cuándo.',
        ruta: 'reporte', sensible: true,
      };
    }
    if (caida >= 2) {
      return {
        nivel: 'aviso', titulo: 'Ánimo más bajo de lo habitual', detalleTecnico: detalle,
        resumenSimple: 'Tu ánimo está algo más bajo que de costumbre.',
        textoCalmado: 'Hoy quizá sea buen día para darte un respiro.',
        accion: 'Reserva un rato para ti: el jardín, tu diario o una llamada con tu familia.',
        ruta: 'autogestion', sensible: true,
      };
    }
    return normal('Estado de ánimo', detalle, true);
  },
);

export const reglaEstres = definirRegla(
  {
    id: 'mental.estres', nombre: 'Estrés agudo', sistema: 'cerebro',
    sensores: ['estres'],
    fuente: 'Anexo B: salud conductual · Documento de visión: ejemplo de EVA con ataque de pánico',
  },
  (h, p) => {
    const ult = h.ultima('estres');
    if (!ult) return null;
    const base = p.lineaBase.estres ?? 30;
    const detalle = `Índice de estrés ${ult.valor}/100 (línea base ${base})`;
    const accionEva = 'Asegura bien tu arnés y, si puedes, llama a tu compañero.';

    if (ult.valor >= 80) {
      return {
        nivel: 'alerta', titulo: 'Estrés muy alto (compatible con crisis de pánico)', detalleTecnico: detalle,
        resumenSimple: 'Tu nivel de estrés está muy alto.',
        textoCalmado: 'Tómate un momento. Respira lento y profundo.',
        accion: 'Pausa lo que haces, respira lento: cuatro segundos inhalando, seis exhalando. Avisa a un compañero.',
        accionPorUbicacion: { eva: accionEva },
        pasos: [
          'Asegúrate de estar sujeto y en un lugar seguro.',
          'Respira cuatro segundos, retén dos y exhala seis. Repite cinco veces.',
          'Nombra en voz baja cinco cosas que ves a tu alrededor.',
          'Si puedes, habla con un compañero.',
        ],
        ruta: 'reporte', sensible: true,
      };
    }
    if (ult.valor >= 60) {
      return {
        nivel: 'aviso', titulo: 'Estrés elevado', detalleTecnico: detalle,
        resumenSimple: 'Tu nivel de estrés está subiendo.',
        textoCalmado: 'Buen momento para una pausa breve.',
        accion: 'Haz una pausa de dos minutos y respira lento.',
        accionPorUbicacion: { eva: accionEva },
        ruta: 'autogestion', sensible: true,
      };
    }
    return normal('Estrés', detalle, true);
  },
);
