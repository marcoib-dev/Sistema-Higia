// AVISO: UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
import type { Destino } from '../tipos';
import { definirRegla, HORA, MINUTO, normal, pendiente, r1 } from './util';

/** Límite de carrera de NASA-STD-3001 (600 mSv). VERIFICAR en fuente oficial antes de citarlo. */
export const LIMITE_CARRERA_MSV = 600;
/** Tasa que sugiere un evento de partículas solares. Valor de ejemplo. */
const TASA_TORMENTA_MSV_H = 1;
/** Fuera de la magnetosfera (Luna, Marte) no hay burbuja protectora: la alerta salta antes (§7.3.1). */
const FACTOR_TASA_DESTINO: Record<Destino, number> = { orbita: 1, luna: 0.5, marte: 0.5 };
/** Duración típica de la misión por destino, en días (provisional): para proyectar si se llega al límite. */
export const DURACION_MISION_DIAS: Record<Destino, number> = { orbita: 180, luna: 180, marte: 900 };

export const reglaRadiacion = definirRegla(
  {
    id: 'radiacion.dosis', nombre: 'Exposición a radiación', sistema: 'cuerpo',
    sensores: ['dosisRadiacion'],
    fuente: 'Anexo A: peligro de radiación · Anexo F: dosímetros',
    hrp: ['radiacion'],
  },
  (h, _p, ahora, c) => {
    const ult = h.ultima('dosisRadiacion');
    if (!ult) return null;

    // Contexto: tormenta solar reportada (por el hábitat, sensores de entorno o la IA de cámara).
    if (c.climaEspacial === 'tormentaSolar') {
      const fuera = c.ubicacion !== 'habitat';
      return {
        nivel: fuera ? 'alerta' : 'aviso', bloquea: ['eva'],
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
    const umbralTasa = TASA_TORMENTA_MSV_H * FACTOR_TASA_DESTINO[c.destino];
    if (tasa >= umbralTasa) {
      return {
        nivel: 'alerta', titulo: 'Aumento brusco de radiación (posible tormenta solar)', bloquea: ['eva'],
        detalleTecnico: `Tasa de ${r1(tasa)} mSv/h (umbral ${r1(umbralTasa)} mSv/h ${c.destino === 'orbita' ? 'en órbita' : 'fuera de la magnetosfera'}) · acumulado ${r1(ult.valor)} mSv`,
        resumenSimple: 'La radiación está subiendo rápido.',
        accion: 'Dirígete al refugio de radiación del hábitat.',
        accionPorUbicacion: { eva: 'Regresa a la esclusa y al refugio de inmediato.', rover: 'Vuelve al hábitat o activa el blindaje del rover.' },
        pasos: [
          'Deja lo que estás haciendo y ve al refugio de radiación (o a la zona más blindada).',
          'Si estás fuera, regresa a la esclusa por el camino más corto con tu compañero.',
          'Lleva el dosímetro contigo y no salgas hasta que Higia o el hábitat lo indiquen.',
        ],
        ruta: 'reporte', sensible: false,
      };
    }

    const fraccion = ult.valor / LIMITE_CARRERA_MSV;
    // Proyección: con el ritmo de los últimos 7 días, ¿cuándo se alcanza el límite?
    const ritmo = pendiente(h, 'dosisRadiacion', ahora, 7);
    const diasAlLimite = ritmo && ritmo > 0 ? Math.max(0, Math.round((LIMITE_CARRERA_MSV - ult.valor) / ritmo)) : null;
    const diasRestantes = Math.max(0, DURACION_MISION_DIAS[c.destino] - c.diaMision);
    const proyeccion = diasAlLimite !== null && fraccion < 1
      ? ` · a este ritmo (${r1(ritmo!)} mSv/día) alcanzas el límite en ${diasAlLimite} días; quedan ~${diasRestantes} de misión`
      : '';
    const detalle = `${r1(ult.valor)} mSv acumulados (${Math.round(fraccion * 100)} % del límite de carrera)${proyeccion}`;
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
    if (diasAlLimite !== null && diasAlLimite < diasRestantes) {
      return {
        nivel: 'info', titulo: 'La dosis proyectada supera el límite antes del fin de la misión', detalleTecnico: detalle,
        resumenSimple: 'Al ritmo actual, superarías el máximo de radiación antes de terminar la misión.',
        accion: 'Conviene revisar con el equipo el plan de EVA y el tiempo en zonas blindadas.',
        ruta: 'reporte', sensible: false,
      };
    }
    return normal('Radiación', detalle);
  },
);
