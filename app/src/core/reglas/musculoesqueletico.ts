// AVISO: UMBRALES PROVISIONALES: validar con kinesiología y con §7.1.9, §7.1.11, §7.2.5 y el Anexo F antes de la demo.
// Huesos y músculos: ejercicio del día, adherencia semanal, fuerza y aptitud aeróbica, pérdida ósea estimada
// y cargas dinámicas (aterrizajes, impactos en el torso).
import type { Historial } from '../historial';
import { promedio } from '../historial';
import type { Contexto, Nivel, Perfil } from '../tipos';
import {
  caidaRelativa, dato, datosDe, definirRegla, diasCumpliendo, normal, pct, porDia, r1, subirNivel, tieneAntecedente, ultimaReciente,
  type DatosHallazgo,
} from './util';

const META_MINUTOS = 90; // 1,5 h/día de resistencia + aeróbico (Anexo F, contramedidas)
const META_RESISTENCIA = 30; // min/día de resistencia (provisional)
const ultimoDelDia = (xs: number[]) => xs[xs.length - 1];

export const reglaEjercicio = definirRegla(
  {
    id: 'musculo.ejercicio', nombre: 'Ejercicio diario', sistema: 'musculos',
    sensores: ['minutosEjercicio'],
    fuente: 'Anexo F: contramedida de 1,5 h/día de ejercicio · Anexo G: huesos y músculos',
    hrp: ['aptitud', 'oseo'],
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

// ── Adherencia semanal ─────────────────────────────────────────────────

export const reglaAdherencia = definirRegla(
  {
    id: 'musculo.adherencia', nombre: 'Constancia del ejercicio', sistema: 'musculos',
    sensores: ['minutosEjercicio', 'minutosResistencia'],
    fuente: '§7.1.9: 6 a 7 días por semana, 1,5 h por día de fuerza y aeróbico',
    hrp: ['aptitud', 'oseo'],
  },
  (h, p, ahora) => {
    const dias = porDia(h, 'minutosEjercicio', ahora, 7, ultimoDelDia);
    // Con menos de tres días registrados no hay semana que evaluar.
    if (dias.length < 3) return null;
    const cumplen = dias.filter((d) => d.valor >= META_MINUTOS).length;
    const resistencia = porDia(h, 'minutosResistencia', ahora, 7, ultimoDelDia);
    const resMedia = resistencia.length ? r1(promedio(resistencia.map((d) => d.valor))) : undefined;
    const pocaResistencia = resMedia !== undefined && resMedia < META_RESISTENCIA;
    const datos = [...dias.map((d) => dato(d.lecturas.at(-1)!, p)), ...resistencia.map((d) => dato(d.lecturas.at(-1)!, p))];
    const detalle = `${cumplen} de los últimos 7 días con ${META_MINUTOS} min o más` +
      `${resMedia !== undefined ? ` · resistencia media ${resMedia} min/día` : ''}`;
    const nivel: Nivel = cumplen < 4 ? 'aviso' : cumplen < 6 || pocaResistencia ? 'info' : 'normal';
    if (nivel === 'normal') return { ...normal('Constancia del ejercicio', detalle), datos };
    return {
      nivel, titulo: nivel === 'aviso' ? 'Semana con poco ejercicio' : 'Semana de ejercicio incompleta', detalleTecnico: detalle, datos,
      resumenSimple: pocaResistencia
        ? 'Esta semana faltó ejercicio de resistencia: es lo que más protege tus huesos y músculos.'
        : 'Esta semana hiciste menos días de ejercicio de los recomendados.',
      accion: `La meta es 6 a 7 días por semana, ${META_MINUTOS} min por día, con al menos ${META_RESISTENCIA} min de resistencia.`,
      ruta: 'autogestion', sensible: false,
    };
  },
);

// ── Fuerza y aptitud aeróbica ──────────────────────────────────────────

export const reglaAptitud = definirRegla(
  {
    id: 'musculo.aptitud', nombre: 'Fuerza y aptitud aeróbica', sistema: 'musculos',
    sensores: ['fuerza', 'aptitudAerobica'],
    fuente: '§7.1.9: pérdida promedio 10–12 %; entre el 12 y el 38 % pierde más del 20 % · Standard Measures: fuerza corporal total',
    hrp: ['aptitud'],
  },
  (h, p, ahora) => {
    const mes = 45 * 24;
    const fuerza = ultimaReciente(h, 'fuerza', ahora, mes);
    const aerobica = ultimaReciente(h, 'aptitudAerobica', ahora, mes);
    if (!fuerza && !aerobica) return null;
    const bF = p.lineaBase.fuerza ?? 100;
    const bA = p.lineaBase.aptitudAerobica ?? 40;
    const cF = fuerza ? caidaRelativa(fuerza.valor, bF) : 0;
    const cA = aerobica ? caidaRelativa(aerobica.valor, bA) : 0;
    const peor = Math.max(cF, cA);
    const tendencia = (s: 'fuerza' | 'aptitudAerobica') => {
      const ls = h.ultimas(s, 3);
      return ls.length >= 2 ? ` (antes ${ls.slice(0, -1).map((l) => r1(l.valor)).join(' → ')})` : '';
    };
    const partes = [
      fuerza && `fuerza ${r1(fuerza.valor)} (línea base ${bF}, ${cF > 0 ? '−' : '+'}${pct(Math.abs(cF))})${tendencia('fuerza')}`,
      aerobica && `aptitud aeróbica ${r1(aerobica.valor)} mL/kg/min (línea base ${bA}, ${cA > 0 ? '−' : '+'}${pct(Math.abs(cA))})${tendencia('aptitudAerobica')}`,
    ].filter(Boolean);
    const detalle = partes.join(' · ');
    const datos = [...h.ultimas('fuerza', 3), ...h.ultimas('aptitudAerobica', 3)].map((l) => dato(l, p));
    const nivel: Nivel = peor >= 0.3 ? 'alerta' : peor >= 0.2 ? 'aviso' : peor >= 0.1 ? 'info' : 'normal';
    if (nivel === 'normal') return { ...normal('Fuerza y aptitud', detalle), datos };
    const queBaja = cF >= cA ? 'fuerza' : 'aptitud aeróbica';
    const d: DatosHallazgo = {
      nivel, detalleTecnico: detalle, datos,
      titulo: nivel === 'info' ? `Pérdida esperable de ${queBaja}` : `Pérdida de ${queBaja} mayor a la esperable`,
      resumenSimple: nivel === 'info'
        ? 'Perdiste algo de condición física: es lo habitual en vuelo (10–12 % en promedio).'
        : 'Perdiste más condición física de lo habitual: conviene ajustar el entrenamiento.',
      accion: 'Ajusta el plan de entrenamiento con prioridad en resistencia y repite la evaluación en dos semanas.',
      ruta: nivel === 'info' ? 'autogestion' : 'reporte', sensible: false,
      bloquea: nivel === 'alerta' ? ['eva'] : undefined,
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'Pospón las EVA largas hasta recuperar parte de la fuerza: el traje exige mucho.',
        'Prioriza el ejercicio de resistencia todos los días.',
        'Come lo suficiente: sin calorías y proteína el músculo no se recupera.',
        'Repite la prueba de fuerza en dos semanas.',
        'Higia envía el reporte para que Tierra ajuste tu plan.',
      ];
    }
    return d;
  },
);

// ── Pérdida ósea estimada ──────────────────────────────────────────────

/** Tasa de pérdida ósea por mes (§7.1.11: 1–1,5 %/mes), según la adherencia a la resistencia. */
export const TASA_OSEA = { buena: 0.5, parcial: 1.0, mala: 1.5 };

export interface EstimacionOsea {
  perdida: number;
  tasa: number;
  adherencia: keyof typeof TASA_OSEA | 'sinDatos';
  diasConResistencia: number;
  diasConDatos: number;
  osteopenia: boolean;
}

/**
 * En vuelo no hay densitometría (Anexo F: solo en Tierra): se estima la pérdida con el día de misión
 * y la adherencia al ejercicio de resistencia de los últimos 30 días. Lo reusan otras reglas.
 */
export function perdidaOseaEstimada(h: Historial, p: Perfil, ahora: number, c: Contexto): EstimacionOsea {
  const { cumplen, conDatos } = diasCumpliendo(h, 'minutosResistencia', ahora, 30, (v) => v >= META_RESISTENCIA, ultimoDelDia);
  const proporcion = conDatos ? cumplen / conDatos : NaN;
  const adherencia = !conDatos ? 'sinDatos' : proporcion >= 0.85 ? 'buena' : proporcion >= 0.5 ? 'parcial' : 'mala';
  const tasa = adherencia === 'sinDatos' ? TASA_OSEA.parcial : TASA_OSEA[adherencia];
  return {
    perdida: r1((Math.max(0, c.diaMision) / 30) * tasa), tasa, adherencia, diasConResistencia: cumplen, diasConDatos: conDatos,
    osteopenia: tieneAntecedente(p, 'huesos', /osteopen|osteopor/i),
  };
}

export const reglaHueso = definirRegla(
  {
    id: 'hueso.perdida', nombre: 'Pérdida ósea estimada', sistema: 'huesos',
    sensores: ['minutosResistencia', 'calcioUrinario'],
    fuente: '§7.1.11: 1–1,5 % de densidad por mes en columna y caderas · CIPHER Bone Health: calcio urinario · Anexo F: densitometría solo en Tierra',
    hrp: ['oseo'],
  },
  (h, p, ahora, c) => {
    const e = perdidaOseaEstimada(h, p, ahora, c);
    const calcio = ultimaReciente(h, 'calcioUrinario', ahora, 30 * 24);
    const calcioAlto = !!calcio && calcio.valor > 250;
    const u = e.osteopenia ? { info: 3, aviso: 7, alerta: 12 } : { info: 5, aviso: 10, alerta: 15 };
    let nivel: Nivel = e.perdida >= u.alerta ? 'alerta' : e.perdida >= u.aviso ? 'aviso' : e.perdida >= u.info ? 'info' : 'normal';
    if (calcioAlto) nivel = nivel === 'normal' ? 'info' : subirNivel(nivel);
    const ADH = { buena: 'buena', parcial: 'parcial', mala: 'baja', sinDatos: 'sin registros (se asume la tasa promedio)' };
    const detalle = `Estimación: ${e.perdida} % de densidad ósea perdida (día ${c.diaMision} de misión × ${e.tasa} %/mes)` +
      ` · adherencia a la resistencia ${ADH[e.adherencia]}${e.diasConDatos ? ` (${e.diasConResistencia} de ${e.diasConDatos} días con ${META_RESISTENCIA} min o más)` : ''}` +
      `${calcio ? ` · calcio en orina ${calcio.valor} mg/día${calcioAlto ? ' (alto: el hueso libera calcio)' : ''}` : ''}` +
      `${e.osteopenia ? ' · antecedente de osteopenia: umbrales más bajos' : ''}`;
    const datos = [
      ...porDia(h, 'minutosResistencia', ahora, 30, ultimoDelDia).slice(-7).map((d) => dato(d.lecturas.at(-1)!, p)),
      ...datosDe(p, calcio),
    ];
    if (nivel === 'normal') return { ...normal('Huesos', detalle), datos, region: 'columna' };
    const agua = calcioAlto ? ' Bebe más agua: el calcio que sale del hueso puede formar cálculos.' : '';
    const d: DatosHallazgo = {
      nivel, detalleTecnico: detalle, datos, region: 'columna',
      titulo: nivel === 'info' ? 'Pérdida ósea en curso' : 'Pérdida ósea estimada alta',
      resumenSimple: 'En el espacio los huesos de la columna y la cadera se debilitan poco a poco.',
      accion: `Prioriza el ejercicio de resistencia todos los días.${agua}`,
      ruta: nivel === 'info' ? 'autogestion' : 'reporte', sensible: false,
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'Haz ejercicio de resistencia todos los días: es la contramedida que más protege el hueso.',
        'Evita cargas bruscas en la columna (saltos, impactos, levantar mucho peso de golpe).',
        'Bebe al menos dos litros de agua al día.',
        'Consulta con Tierra si corresponde medicación (bifosfonatos).',
        'Higia envía el reporte con la estimación y sus insumos.',
      ];
    }
    return d;
  },
);

// ── Cargas dinámicas (aterrizajes, impactos en el torso) ───────────────

export const CARGA = { info: 8, aviso: 12, alerta: 20 };

export const reglaCargaDinamica = definirRegla(
  {
    id: 'lesion.cargaDinamica', nombre: 'Cargas dinámicas en el cuerpo', sistema: 'huesos',
    sensores: ['aceleracionCuerpo', 'sxDolorEspalda'],
    fuente: '§7.2.5 Lesiones por cargas dinámicas (aterrizaje, transiciones de gravedad, pérdida ósea) · Spacecraft Occupant Protection',
    hrp: ['cargasDinamicas', 'oseo'],
  },
  (h, p, ahora, c) => {
    const ls = h.desde('aceleracionCuerpo', ahora - 24 * 3_600_000);
    if (!ls.length) return null;
    const pico = ls.reduce((a, b) => (b.valor > a.valor ? b : a));
    const dolor = h.desde('sxDolorEspalda', pico.timestamp).at(-1);
    const conDolor = (dolor?.valor ?? 0) >= 4;
    const oseo = perdidaOseaEstimada(h, p, ahora, c);
    const huesoDebil = oseo.perdida >= 10 || oseo.osteopenia;
    let nivel: Nivel = pico.valor >= CARGA.alerta ? 'alerta' : pico.valor >= CARGA.aviso ? 'aviso' : pico.valor >= CARGA.info ? 'info' : 'normal';
    if (nivel !== 'normal' && conDolor) nivel = subirNivel(nivel);
    if (nivel !== 'normal' && huesoDebil) nivel = subirNivel(nivel);
    const detalle = `Pico de ${r1(pico.valor)} g en el torso` +
      `${dolor && dolor.valor > 0 ? ` · dolor de espalda ${dolor.valor}/10 después de la carga` : ''}` +
      `${huesoDebil ? ` · hueso debilitado (${oseo.osteopenia ? 'osteopenia' : `pérdida ósea estimada ${oseo.perdida} %`})` : ''}`;
    const datos = datosDe(p, pico, dolor);
    if (nivel === 'normal') return { ...normal('Cargas en el cuerpo', detalle), datos };
    const d: DatosHallazgo = {
      nivel, detalleTecnico: detalle, datos, region: 'columna',
      titulo: conDolor ? 'Posible lesión de columna por la carga' : 'Carga alta sobre el cuerpo',
      resumenSimple: conDolor
        ? 'Te duele la espalda después de una carga fuerte: hay que descartar una lesión.'
        : 'Tu cuerpo recibió una sacudida fuerte.',
      accion: 'Muévete despacio, evita cargar peso y avisa si aparece dolor, hormigueo o debilidad.',
      ruta: nivel === 'info' ? 'autogestion' : 'reporte', sensible: false,
      bloquea: nivel === 'info' ? undefined : ['eva', 'ejercicioIntenso'],
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'No te levantes ni gires el tronco: quédate quieto en el asiento o recostado.',
        'Si hay dolor de cuello o espalda, inmoviliza la columna (collar y tabla si están disponibles).',
        'Revisa si hay hormigueo o debilidad en brazos o piernas y díselo a Higia.',
        'Un compañero debe ayudarte a salir del vehículo, sin tirar de tu cuerpo.',
        'Higia envía el reporte con el pico de carga registrado.',
      ];
    }
    return d;
  },
);

// ── Fuerza isométrica (dinamómetro de prensión) ─────────────────────────

/** Valor de referencia si la persona no tiene línea base previa al vuelo (kg). */
export const ISOMETRICA_REFERENCIA = 40;

export const reglaFuerzaIsometrica = definirRegla(
  {
    id: 'musculo.isometrica', nombre: 'Fuerza isométrica', sistema: 'musculos',
    sensores: ['fuerzaIsometrica'],
    fuente: '§7.1.9: pérdida de fuerza en vuelo (10–12 % en promedio) · Standard Measures: fuerza isométrica de prensión con dinamómetro',
    hrp: ['aptitud'],
  },
  (h, p, ahora) => {
    const ult = ultimaReciente(h, 'fuerzaIsometrica', ahora, 45 * 24);
    if (!ult) return null;
    const base = p.lineaBase.fuerzaIsometrica ?? ISOMETRICA_REFERENCIA;
    const caida = caidaRelativa(ult.valor, base);
    const previas = h.ultimas('fuerzaIsometrica', 3);
    const tendencia = previas.length >= 2 ? ` (antes ${previas.slice(0, -1).map((l) => r1(l.valor)).join(' → ')} kg)` : '';
    const detalle = `Prensión isométrica máxima ${r1(ult.valor)} kg (línea base ${base} kg, ${caida > 0 ? '−' : '+'}${pct(Math.abs(caida))})${tendencia}`;
    const datos = previas.map((l) => dato(l, p));
    const nivel: Nivel = caida >= 0.3 ? 'alerta' : caida >= 0.2 ? 'aviso' : caida >= 0.1 ? 'info' : 'normal';
    if (nivel === 'normal') return { ...normal('Fuerza isométrica', detalle), datos, region: 'brazos' };
    const d: DatosHallazgo = {
      nivel, detalleTecnico: detalle, datos, region: 'brazos',
      titulo: nivel === 'info' ? 'Fuerza isométrica algo más baja' : 'Pérdida de fuerza isométrica mayor a la esperable',
      resumenSimple: nivel === 'info'
        ? 'Tu fuerza de agarre bajó un poco: es lo habitual en vuelo.'
        : 'Tu fuerza de agarre bajó más de lo habitual: afecta el manejo de herramientas y del traje.',
      accion: 'Suma ejercicio de resistencia de brazos y manos y repite la prueba en una semana.',
      accionPorUbicacion: { eva: 'Si notas que te cuesta sujetar herramientas o los pasamanos, avisa y acorta la EVA.' },
      ruta: nivel === 'info' ? 'autogestion' : 'reporte', sensible: false,
      bloquea: nivel === 'alerta' ? ['eva'] : undefined,
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'Pospón las EVA largas: los guantes del traje exigen mucha fuerza de agarre.',
        'Haz ejercicio de resistencia de antebrazos y manos todos los días.',
        'Revisa que estés comiendo suficiente proteína y calorías.',
        'Repite la prueba isométrica en una semana, con la misma mano y la misma postura.',
        'Higia envía el reporte para que Tierra ajuste tu plan de entrenamiento.',
      ];
    }
    return d;
  },
);
