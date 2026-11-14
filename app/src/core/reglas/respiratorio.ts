// AVISO: UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
import { promedio } from '../historial';
import type { Nivel } from '../tipos';
import { dato, datosDe, DIA, definirRegla, normal, r1, recientes, ultimaReciente } from './util';

export const reglaSaturacionOxigeno = definirRegla(
  {
    id: 'pulmones.spo2', nombre: 'Saturación de oxígeno', sistema: 'pulmones',
    sensores: ['spo2'],
    fuente: 'Anexo F: síntomas de hipoxia leve · Anexo G: pulmones / respiración',
    hrp: ['hipoxia'],
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
        ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje', 'ejercicioIntenso'],
      };
    }
    if (v < 92) {
      return {
        nivel: 'aviso', titulo: 'Oxígeno en sangre bajo', detalleTecnico: detalle,
        resumenSimple: 'Tu nivel de oxígeno está más bajo de lo normal.',
        accion: 'Reduce el esfuerzo y respira profundo. Si aparece confusión o dolor de cabeza, avisa a un compañero.',
        accionPorUbicacion: { eva: accionEva },
        ruta: 'autogestion', sensible: false, bloquea: ['eva', 'pilotaje', 'ejercicioIntenso'],
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

// ── Hipoxia leve por la atmósfera de la cabina ─────────────────────────

/** ppO₂ de la cabina (kPa). Al nivel del mar es ~21 kPa. */
export const PPO2 = { baja: 19, aviso: 18, alerta: 16 };

export const reglaHipoxiaCabina = definirRegla(
  {
    id: 'hipoxia.cabina', nombre: 'Hipoxia leve por la cabina', sistema: 'pulmones',
    sensores: ['ppO2Cabina', 'spo2', 'sxCefalea', 'sxVision', 'orientacion', 'horasSueno'],
    fuente: '§7.1.6 Hipoxia: cabina parcialmente despresurizada; síntomas de hipoxia leve (confusión, dolor de cabeza, visión, sueño)',
    hrp: ['hipoxia'],
  },
  (h, p, ahora) => {
    const pp = ultimaReciente(h, 'ppO2Cabina', ahora, 24);
    const sats = recientes(h, 'spo2', ahora, 24);
    const satMedia = sats.length ? r1(promedio(sats.map((l) => l.valor))) : undefined;
    const cefalea = ultimaReciente(h, 'sxCefalea', ahora, 24);
    const vision = ultimaReciente(h, 'sxVision', ahora, 24);
    const orient = ultimaReciente(h, 'orientacion', ahora, 24);
    const noches = h.ultimas('horasSueno', 3).filter((l) => l.timestamp >= ahora - 4 * DIA);
    const sueno = noches.length ? r1(promedio(noches.map((n) => n.valor))) : undefined;
    // Los cuatro síntomas de §7.1.6.
    const sintomas = [
      (cefalea?.valor ?? 0) >= 3 && `dolor de cabeza ${cefalea!.valor}/10`,
      (vision?.valor ?? 0) >= 3 && `cambios de visión ${vision!.valor}/10`,
      !!orient && orient.valor <= 7 && `orientación ${orient.valor}/10`,
      sueno !== undefined && sueno < 6 && `sueño promedio ${sueno} h`,
    ].filter((x): x is string => !!x);
    const oxigenoJusto = (satMedia !== undefined && satMedia >= 90 && satMedia <= 94) || (!!pp && pp.valor < PPO2.baja);
    const cuadro = sintomas.length >= 2 && oxigenoJusto;
    if (!pp && !cuadro) return null;

    const partes = [
      pp && `ppO₂ de cabina ${r1(pp.valor)} kPa`,
      satMedia !== undefined && `SpO₂ media 24 h ${satMedia} %`,
      sintomas.length > 0 && `síntomas: ${sintomas.join(', ')}`,
    ].filter(Boolean);
    const detalle = partes.join(' · ');
    const datos = [...datosDe(p, pp, cefalea, vision, orient), ...sats.slice(-3).map((l) => dato(l, p)), ...noches.map((n) => dato(n, p))];
    const nivel: Nivel = pp && pp.valor < PPO2.alerta ? 'alerta' : (pp && pp.valor < PPO2.aviso) || cuadro ? 'aviso' : 'normal';
    if (nivel === 'normal') return { ...normal('Oxígeno de la cabina', detalle), datos };

    if (nivel === 'alerta') {
      return {
        nivel, titulo: 'Oxígeno de la cabina muy bajo', detalleTecnico: detalle, datos,
        resumenSimple: 'El aire de la cabina tiene poco oxígeno.',
        accion: 'Colócate la máscara de oxígeno, revisa el control atmosférico y avisa a la tripulación.',
        pasos: [
          'Colócate la máscara o el suministro de oxígeno de emergencia.',
          'Avisa a toda la tripulación: el aire es el mismo para todos.',
          'Revisa el panel de control atmosférico (presión y oxígeno de la cabina).',
          'No hagas esfuerzo físico hasta que se normalice.',
          'Si alguien se confunde o se duerme, que no se quede solo.',
        ],
        ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje'],
      };
    }
    return {
      nivel, titulo: cuadro ? 'Posible hipoxia leve' : 'Oxígeno de la cabina bajo', detalleTecnico: detalle, datos,
      region: cuadro ? 'craneo' : undefined,
      resumenSimple: cuadro
        ? 'Tus síntomas pueden deberse a un poco menos de oxígeno: es parecido al mal de altura.'
        : 'El aire de la cabina tiene algo menos de oxígeno de lo habitual.',
      textoCalmado: 'Es parecido a llegar a una ciudad de montaña: con descanso y buen aire se pasa.',
      accion: 'Reduce el esfuerzo, hidrátate y pide revisar la mezcla de la cabina. Higia volverá a medir tu oxígeno.',
      ruta: 'reporte', sensible: false,
    };
  },
);
