// AVISO: UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
import { ORDEN_NIVEL, type Nivel } from '../tipos';
import { datosDe, definirRegla, normal, signo, subirNivel, tieneAntecedente, ultimaReciente, type DatosHallazgo } from './util';

export const reglaFrecuenciaCardiaca = definirRegla(
  {
    id: 'cardio.frecuencia', nombre: 'Frecuencia cardíaca', sistema: 'corazon',
    sensores: ['frecuenciaCardiaca'],
    fuente: 'Anexo F: frecuencia cardíaca · Anexo B: adaptaciones cardiovasculares y arritmias',
    hrp: ['cardiovascular'],
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
    hrp: ['cardiovascular'],
  },
  (h, _p, _ahora, c) => {
    const sis = h.ultima('presionSistolica')?.valor;
    const dia = h.ultima('presionDiastolica')?.valor;
    if (sis === undefined || dia === undefined) return null;
    // Tras un cambio de gravedad (aterrizaje, llegada a la superficie) la presión baja es esperable y peligrosa al ponerse de pie.
    const transicion = c.transicionGravedad;
    const detalle = `PA ${sis}/${dia} mmHg${transicion ? ' · transición de gravedad reciente' : ''}`;
    const contramedidas = 'Usa las prendas de compresión y bebe medio litro de líquido antes de ponerte de pie.';

    if (sis < 80) {
      return {
        nivel: 'alerta', titulo: 'Presión arterial muy baja', detalleTecnico: detalle,
        resumenSimple: 'Tu presión está muy baja y podrías desmayarte.',
        accion: transicion
          ? `Recuéstate con las piernas elevadas y no te levantes. ${contramedidas} Avisa a un compañero.`
          : 'Recuéstate con las piernas elevadas y bebe líquido. Avisa a un compañero.',
        pasos: [
          'Recuéstate de inmediato; en microgravedad, sujétate a una superficie.',
          'Eleva las piernas por encima del nivel del corazón.',
          'Bebe medio litro de agua o de solución con electrolitos.',
          ...(transicion ? ['Ponte las prendas de compresión de las piernas antes de intentar levantarte.'] : []),
          'No te levantes durante 15 minutos y vuelve a medir la presión.',
          'Si pierdes la visión, te confundes o te desmayas, un compañero debe asistirte.',
        ],
        posibleIncapacidad: true,
        ruta: 'reporte', sensible: false, bloquea: ['pilotaje', 'eva', 'ejercicioIntenso'],
      };
    }
    if (sis < 90 || (transicion && sis < 100)) {
      return {
        nivel: 'aviso', titulo: transicion ? 'Presión baja tras el cambio de gravedad' : 'Presión arterial baja', detalleTecnico: detalle,
        resumenSimple: 'Tu presión está baja; podrías marearte al moverte rápido.',
        accion: transicion
          ? `Levántate despacio, en dos tiempos. ${contramedidas}`
          : 'Hidrátate y evita cambios bruscos de postura. Considera usar prendas de compresión.',
        ruta: 'autogestion', sensible: false, bloquea: transicion ? ['pilotaje'] : undefined,
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

// ── Arritmias ──────────────────────────────────────────────────────────

export const reglaArritmia = definirRegla(
  {
    id: 'cardio.arritmia', nombre: 'Ritmo cardíaco irregular', sistema: 'corazon',
    sensores: ['irregularidadRitmo', 'frecuenciaCardiaca'],
    fuente: '§7.1.3 Adaptaciones cardiovasculares (arritmias) · CIPHER Coronary Responses: fibrilación auricular',
    hrp: ['cardiovascular'],
  },
  (h, p, ahora, c) => {
    const irr = ultimaReciente(h, 'irregularidadRitmo', ahora, 6);
    if (!irr) return null;
    const fc = ultimaReciente(h, 'frecuenciaCardiaca', ahora, 1);
    const datos = datosDe(p, irr, fc);
    const enReposo = c.actividad !== 'ejercicio' && c.ubicacion !== 'eva';
    const taquicardia = !!fc && enReposo && fc.valor >= 120;
    const antecedente = tieneAntecedente(p, 'corazon');
    let nivel: Nivel = irr.valor >= 15 || (irr.valor >= 5 && taquicardia) ? 'alerta' : irr.valor >= 5 ? 'aviso' : 'normal';
    if (nivel === 'aviso' && antecedente) nivel = subirNivel(nivel);
    const detalle = `${irr.valor} % de latidos irregulares${fc ? ` · FC ${fc.valor} lpm${enReposo ? ' en reposo' : ''}` : ''}` +
      `${antecedente ? ` · antecedente cardiovascular: ${p.historiaClinica.antecedentes.filter((a) => a.sistema === 'corazon').map((a) => a.nombre).join(', ')}` : ''}`;
    if (nivel === 'normal') return { ...normal('Ritmo cardíaco', detalle), datos };
    if (nivel === 'aviso') {
      return {
        nivel, titulo: 'Latidos irregulares', detalleTecnico: detalle, datos, region: 'torax',
        resumenSimple: 'Tu corazón tiene algunos latidos fuera de ritmo.',
        accion: 'Evita el esfuerzo intenso, hidrátate y evita la cafeína. Higia seguirá el ritmo de cerca.',
        ruta: 'reporte', sensible: false, bloquea: ['ejercicioIntenso', 'eva'],
      };
    }
    return {
      nivel, titulo: 'Ritmo cardíaco muy irregular', detalleTecnico: detalle, datos, region: 'torax',
      resumenSimple: 'Tu corazón late de forma muy irregular.',
      accion: 'Detén la actividad, siéntate o sujétate y no te quedes solo. Higia avisa al equipo médico.',
      accionPorUbicacion: { eva: 'Detén la tarea, asegúrate al arnés y avisa a tu compañero para volver juntos a la esclusa.' },
      pasos: [
        'Detén toda actividad y siéntate o sujétate a una superficie.',
        'Respira lento y tranquilo; no hagas fuerza.',
        'Si hay monitor o ECG a bordo, regístralo ahora: ese trazado sirve al médico.',
        'No te quedes solo: avisa a un compañero.',
        'Si aparece dolor en el pecho, falta de aire o sensación de desmayo, díselo a Higia de inmediato.',
      ],
      posibleIncapacidad: true, ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje', 'ejercicioIntenso'],
    };
  },
);

// ── Tromboembolismo venoso ─────────────────────────────────────────────

const GRADO_FLUJO = ['', 'normal', 'lento', 'estancado', 'retrógrado o con trombo sospechado'];

export const reglaTrombosis = definirRegla(
  {
    id: 'vascular.trombosis', nombre: 'Flujo venoso y coágulos', sistema: 'piernas',
    sensores: ['flujoYugular', 'asimetriaPantorrilla', 'sxDolorPierna', 'sxDisnea'],
    fuente: '§8.2 Venous Haemostasis: riesgo de tromboembolismo venoso en vuelo · §7.1.3 coágulos sanguíneos',
    hrp: ['trombosis', 'cardiovascular'],
  },
  (h, p, ahora) => {
    const flujo = ultimaReciente(h, 'flujoYugular', ahora, 7 * 24);
    const asim = ultimaReciente(h, 'asimetriaPantorrilla', ahora, 72);
    if (!flujo && !asim) return null;
    const dolor = ultimaReciente(h, 'sxDolorPierna', ahora, 48);
    const disnea = ultimaReciente(h, 'sxDisnea', ahora, 24);
    const nivelFlujo: Nivel = !flujo ? 'normal' : flujo.valor >= 4 ? 'alerta' : flujo.valor >= 3 ? 'aviso' : flujo.valor >= 2 ? 'info' : 'normal';
    const conDolor = (dolor?.valor ?? 0) >= 4;
    const nivelPierna: Nivel = !asim ? 'normal' : asim.valor >= 3 || (asim.valor >= 2 && conDolor) ? 'alerta' : asim.valor >= 2 ? 'aviso' : 'normal';
    const porCuello = !!flujo && ORDEN_NIVEL[nivelFlujo] >= ORDEN_NIVEL[nivelPierna];
    let nivel: Nivel = porCuello ? nivelFlujo : nivelPierna;
    // Falta de aire con un coágulo posible: puede haber viajado al pulmón.
    const embolia = ORDEN_NIVEL[nivel] >= ORDEN_NIVEL.aviso && (disnea?.valor ?? 0) >= 5;
    if (embolia) nivel = 'alerta';
    const partes = [
      flujo && `flujo yugular grado ${flujo.valor} (${GRADO_FLUJO[flujo.valor] ?? '?'})`,
      asim && `diferencia entre pantorrillas ${asim.valor} cm`,
      dolor && dolor.valor > 0 && `dolor de pierna ${dolor.valor}/10`,
      embolia && `falta de aire ${disnea!.valor}/10`,
    ].filter(Boolean);
    const datos = datosDe(p, flujo, asim, dolor, embolia ? disnea : undefined);
    const detalle = partes.join(' · ');
    if (nivel === 'normal') return { ...normal('Flujo venoso', detalle), datos };

    const d: DatosHallazgo = {
      nivel, region: porCuello ? 'cuello' : 'piernas', datos, detalleTecnico: detalle,
      titulo: embolia ? 'Posible coágulo con falta de aire' : porCuello ? 'Flujo lento en la vena del cuello' : 'Posible coágulo en una pierna',
      resumenSimple: embolia
        ? 'Hay señales de un coágulo y además te falta el aire: hay que actuar ya.'
        : porCuello ? 'La sangre circula más lento de lo normal por una vena del cuello.' : 'Una pierna está más hinchada que la otra: puede ser un coágulo.',
      accion: 'No masajees la zona. Haz una ecografía guiada para confirmar y envía el reporte a Tierra. ' +
        'Los brazaletes de muslo se estudian como contramedida: úsalos solo si el protocolo lo indica.',
      ruta: 'reporte', sensible: false,
      bloquea: nivel === 'info' ? undefined : nivel === 'aviso' ? ['ejercicioIntenso'] : ['eva', 'ejercicioIntenso'],
    };
    if (nivel === 'alerta') {
      if (embolia) d.posibleIncapacidad = true;
      d.pasos = embolia
        ? [
            'Siéntate o sujétate y quédate quieto.',
            'Colócate el oxígeno de emergencia.',
            'No te quedes solo: avisa a un compañero ahora.',
            'Higia envía el reporte urgente a Tierra con tus datos.',
            'Si aparece dolor en el pecho o tos con sangre, díselo a Higia de inmediato.',
          ]
        : [
            'No masajees ni frotes la zona.',
            'Evita el ejercicio intenso hasta tener la ecografía.',
            'Haz la ecografía guiada de la zona (cuello o pierna) y guarda las imágenes.',
            'Envía el reporte a Tierra: el cirujano de vuelo decide el tratamiento.',
            'Si te falta el aire o te duele el pecho, avísalo de inmediato.',
          ];
    }
    return d;
  },
);
