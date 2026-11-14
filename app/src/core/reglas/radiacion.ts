// AVISO: UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
import { definirRegla, HORA, MINUTO, normal, r1 } from './util';

/** Límite de carrera de NASA-STD-3001 (600 mSv). VERIFICAR en fuente oficial antes de citarlo. */
export const LIMITE_CARRERA_MSV = 600;
/** Tasa que sugiere un evento de partículas solares. Valor de ejemplo. */
const TASA_TORMENTA_MSV_H = 1;

export const reglaRadiacion = definirRegla(
  {
    id: 'radiacion.dosis', nombre: 'Exposición a radiación', sistema: 'cuerpo',
    sensores: ['dosisRadiacion'],
    fuente: 'Anexo A: peligro de radiación · Anexo F: dosímetros',
  },
  (h, _p, _ahora, c) => {
    const ult = h.ultima('dosisRadiacion');
    if (!ult) return null;

    // Contexto: tormenta solar reportada (por el hábitat, sensores de entorno o la IA de cámara).
    if (c.climaEspacial === 'tormentaSolar') {
      const fuera = c.ubicacion !== 'habitat';
      return {
        nivel: fuera ? 'alerta' : 'aviso',
        titulo: fuera ? 'Tormenta solar activa estando fuera del hábitat' : 'Tormenta solar activa',
        detalleTecnico: `Evento de partículas solares en curso · acumulado ${r1(ult.valor)} mSv`,
        resumenSimple: fuera ? 'Hay una tormenta solar y estás expuesto.' : 'Hay una tormenta solar en curso.',
        accion: fuera ? 'Regresa al hábitat y ve al refugio de inmediato.' : 'Permanece en la zona blindada hasta que termine.',
        accionPorUbicacion: { rover: 'Vuelve al hábitat o activa el blindaje del rover.' },
        ruta: fuera ? 'reporte' : 'autogestion', sensible: false,
      };
    }

    // Tasa entre las dos últimas lecturas, en mSv/h (Δt mínimo de 5 min para evitar picos por ruido).
    const [ant] = h.ultimas('dosisRadiacion', 2);
    const tasa = ant && ant !== ult
      ? (ult.valor - ant.valor) / (Math.max(ult.timestamp - ant.timestamp, 5 * MINUTO) / HORA)
      : 0;
    if (tasa >= TASA_TORMENTA_MSV_H) {
      return {
        nivel: 'alerta', titulo: 'Aumento brusco de radiación (posible tormenta solar)',
        detalleTecnico: `Tasa de ${r1(tasa)} mSv/h · acumulado ${r1(ult.valor)} mSv`,
        resumenSimple: 'La radiación está subiendo rápido.',
        accion: 'Dirígete al refugio de radiación del hábitat.',
        accionPorUbicacion: { eva: 'Regresa a la esclusa y al refugio de inmediato.', rover: 'Vuelve al hábitat o activa el blindaje del rover.' },
        ruta: 'reporte', sensible: false,
      };
    }

    const fraccion = ult.valor / LIMITE_CARRERA_MSV;
    const detalle = `${r1(ult.valor)} mSv acumulados (${Math.round(fraccion * 100)} % del límite de carrera)`;
    if (fraccion >= 1) {
      return {
        nivel: 'alerta', titulo: 'Límite de dosis de carrera alcanzado', detalleTecnico: detalle,
        resumenSimple: 'Alcanzaste el máximo de radiación permitido.',
        accion: 'Evita actividades fuera del hábitat. Se notificará al equipo médico.',
        ruta: 'reporte', sensible: false,
      };
    }
    if (fraccion >= 0.8) {
      return {
        nivel: 'aviso', titulo: 'Dosis de radiación cercana al límite', detalleTecnico: detalle,
        resumenSimple: 'Te estás acercando al máximo de radiación permitido.',
        accion: 'Prioriza tareas dentro de zonas blindadas.',
        ruta: 'autogestion', sensible: false,
      };
    }
    if (fraccion >= 0.5) {
      return {
        nivel: 'info', titulo: 'Dosis de radiación a mitad del límite', detalleTecnico: detalle,
        resumenSimple: 'Llevas la mitad de la radiación permitida en tu carrera.',
        accion: '', ruta: 'autogestion', sensible: false,
      };
    }
    return normal('Radiación', detalle);
  },
);
