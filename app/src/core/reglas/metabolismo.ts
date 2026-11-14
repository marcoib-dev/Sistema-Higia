// AVISO: UMBRALES PROVISIONALES: validar con el equipo médico y con §7.1.7 y el Anexo F antes de la demo.
// Metabolismo y nutrición: glucemia, ingesta, peso, hidratación y fatiga de menú.
import { promedio } from '../historial';
import type { Nivel } from '../tipos';
import { caidaRelativa, dato, datosDe, definirRegla, normal, pct, pendiente, porDia, r1, ultimaReciente, type DatosHallazgo } from './util';

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

// ── Nutrición ──────────────────────────────────────────────────────────

const ultimoDelDia = (xs: number[]) => xs[xs.length - 1];

export const reglaIngesta = definirRegla(
  {
    id: 'nutricion.ingesta', nombre: 'Ingesta de calorías', sistema: 'metabolismo',
    sensores: ['caloriasDia', 'sxApetito'],
    fuente: '§7.1.7 Alimentación y nutrición · Food Physiology: registro diario de comidas · Food Acceptability: fatiga de menú',
    hrp: ['nutricion'],
  },
  (h, p, ahora) => {
    const dias = porDia(h, 'caloriasDia', ahora, 3, ultimoDelDia);
    if (!dias.length) return null;
    const media = Math.round(promedio(dias.map((d) => d.valor)));
    const req = p.requerimientoCalorico;
    const fraccion = media / req;
    const apetito = ultimaReciente(h, 'sxApetito', ahora, 72);
    const sinApetito = (apetito?.valor ?? 0) >= 5;
    const datos = [...dias.map((d) => dato(d.lecturas.at(-1)!, p)), ...datosDe(p, apetito)];
    const detalle = `Promedio de ${media} kcal/día en ${dias.length} día${dias.length > 1 ? 's' : ''} (${pct(fraccion)} de ${req} kcal)` +
      `${apetito && apetito.valor > 0 ? ` · pérdida de apetito ${apetito.valor}/10` : ''}`;
    const nivel: Nivel = fraccion < 0.6 ? 'alerta' : fraccion < 0.8 ? 'aviso' : 'normal';
    if (nivel === 'normal') return { ...normal('Calorías', detalle), datos };
    const menu = sinApetito ? ' Puede ser fatiga de menú: la comida aburre y se come menos.' : '';
    const d: DatosHallazgo = {
      nivel, titulo: nivel === 'alerta' ? 'Comes mucho menos de lo que necesitas' : 'Comes menos de lo que necesitas', detalleTecnico: detalle, datos,
      resumenSimple: `Estos días comiste menos de lo que tu cuerpo necesita.${menu}`,
      accion: 'Suma una colación entre comidas, prueba otros platos del menú o condimentos, y come en grupo cuando puedas.',
      ruta: nivel === 'alerta' ? 'reporte' : 'autogestion', sensible: false,
    };
    if (nivel === 'alerta') {
      d.bloquea = ['ejercicioIntenso'];
      d.pasos = [
        'Come algo ahora, aunque sea poco: una barra o una bebida con calorías.',
        'Agrega una colación a media mañana y otra a media tarde.',
        'Elige platos distintos a los de los últimos días; usa condimentos.',
        'Registra lo que comes hoy: Higia lo compara con tu meta.',
        'Higia avisa al equipo de nutrición para ajustar tu menú.',
      ];
    }
    return d;
  },
);

export const reglaPeso = definirRegla(
  {
    id: 'nutricion.peso', nombre: 'Peso corporal', sistema: 'metabolismo',
    sensores: ['pesoCorporal'],
    fuente: 'Food Acceptability: la fatiga de menú lleva a pérdida de masa corporal · §7.1.7',
    hrp: ['nutricion'],
  },
  (h, p, ahora) => {
    const ult = ultimaReciente(h, 'pesoCorporal', ahora, 30 * 24);
    if (!ult) return null;
    const base = p.lineaBase.pesoCorporal;
    if (!base) return null;
    const caida = caidaRelativa(ult.valor, base);
    const detalle = `Peso ${r1(ult.valor)} kg (antes del vuelo ${base} kg, ${caida > 0 ? '−' : '+'}${pct(Math.abs(caida))})`;
    const nivel: Nivel = caida >= 0.1 ? 'alerta' : caida >= 0.05 ? 'aviso' : caida >= 0.03 ? 'info' : 'normal';
    if (nivel === 'normal') return normal('Peso', detalle);
    const d: DatosHallazgo = {
      nivel, titulo: nivel === 'info' ? 'Bajaste algo de peso' : 'Pérdida de peso importante', detalleTecnico: detalle,
      resumenSimple: 'Estás perdiendo peso: tu cuerpo usa más energía de la que recibe.',
      accion: 'Revisa cuánto comes cada día y suma una colación. El equipo de nutrición puede ajustar tu menú.',
      ruta: 'reporte', sensible: false,
    };
    if (nivel === 'alerta') {
      d.bloquea = ['ejercicioIntenso'];
      d.pasos = [
        'Registra todo lo que comes durante tres días.',
        'Suma dos colaciones al día con proteína.',
        'Pesa tu cuerpo a la misma hora cada mañana.',
        'Higia envía el reporte al equipo de nutrición.',
      ];
    }
    return d;
  },
);

export const reglaHidratacion = definirRegla(
  {
    id: 'nutricion.hidratacion', nombre: 'Hidratación', sistema: 'metabolismo',
    sensores: ['hidratacion'],
    fuente: 'Anexo F: contramedidas · §7.1.3: beber mucho líquido antes de aterrizar para prevenir la hipotensión',
    hrp: ['nutricion', 'cardiovascular'],
  },
  (h, p, ahora, c) => {
    const dias = porDia(h, 'hidratacion', ahora, 2, ultimoDelDia);
    if (!dias.length) return null;
    const hoy = new Date(ahora).toDateString();
    const ultimo = dias.at(-1)!;
    const esHoy = new Date(ultimo.dia).toDateString() === hoy;
    // El día se evalúa al cierre (desde las 18 h), salvo tras un cambio de gravedad: ahí importa ya.
    const cerrado = !esHoy || c.hora >= 18 || c.transicionGravedad;
    const d = cerrado ? ultimo : dias.length > 1 ? dias[0] : null;
    if (!d) return null;
    const ml = d.valor;
    const objetivo = c.transicionGravedad ? { info: 2000, aviso: 1500 } : { info: 1500, aviso: 1000 };
    const cuando = new Date(d.dia).toDateString() === hoy ? 'hoy' : 'ayer';
    const detalle = `${ml} mL de agua ${cuando}${c.transicionGravedad ? ' · transición de gravedad: objetivo más alto' : ''}`;
    const datos = [dato(d.lecturas.at(-1)!, p)];
    const nivel: Nivel = ml < objetivo.aviso ? 'aviso' : ml < objetivo.info ? 'info' : 'normal';
    if (nivel === 'normal') return { ...normal('Hidratación', detalle), datos };
    return {
      nivel, titulo: 'Poca agua', detalleTecnico: detalle, datos,
      resumenSimple: c.transicionGravedad
        ? 'Bebiste poca agua justo cuando tu cuerpo más la necesita para no marearte al ponerte de pie.'
        : 'Bebiste menos agua de la recomendada.',
      accion: c.transicionGravedad
        ? 'Bebe mucho líquido (con electrolitos si hay) para prevenir la presión baja al ponerte de pie.'
        : 'Ten la bolsa de agua a mano y bebe un vaso cada hora.',
      ruta: 'autogestion', sensible: false,
    };
  },
);

export const reglaFatigaMenu = definirRegla(
  {
    id: 'nutricion.fatigaMenu', nombre: 'Fatiga de menú', sistema: 'intestino',
    sensores: ['aceptabilidadComida'],
    fuente: '§7.1.7 (variedad para evitar la fatiga de menú) · Food Acceptability: encuesta semanal, la variedad es clave',
    hrp: ['nutricion'],
  },
  (h, p, ahora) => {
    const encuestas = h.ultimas('aceptabilidadComida', 3).filter((l) => l.timestamp >= ahora - 60 * 24 * 3_600_000);
    if (!encuestas.length) return null;
    const media = r1(promedio(encuestas.map((l) => l.valor)));
    const tendencia = pendiente(h, 'aceptabilidadComida', ahora, 60);
    const cae = tendencia !== null && tendencia < 0 && encuestas.length >= 3 && encuestas[0].valor - encuestas.at(-1)!.valor >= 1;
    const datos = encuestas.map((l) => dato(l, p));
    const detalle = `Aceptabilidad media ${media}/9 en las últimas ${encuestas.length} encuestas (${encuestas.map((l) => l.valor).join(' → ')})`;
    const nivel: Nivel = media <= 5 ? 'aviso' : cae ? 'info' : 'normal';
    if (nivel === 'normal') return { ...normal('Comida', detalle), datos };
    return {
      nivel, titulo: nivel === 'aviso' ? 'Fatiga de menú' : 'La comida te gusta cada vez menos', detalleTecnico: detalle, datos,
      resumenSimple: 'La comida te está aburriendo: es normal en misiones largas, pero hace que se coma menos.',
      accion: 'Rota el menú, prueba condimentos y salsas, y comparte las comidas con la tripulación.',
      ruta: 'autogestion', sensible: false,
    };
  },
);
