// AVISO: UMBRALES PROVISIONALES: validar con el equipo médico y con §7.1.4 y §7.1.8 antes de la demo.
// Caminatas espaciales (EVA): enfermedad por descompresión y carga física durante la EVA.
import type { Historial } from '../historial';
import type { Contexto, Lectura, Nivel } from '../tipos';
import { dato, datosDe, definirRegla, HORA, MINUTO, normal, r1, recientes, ultimaReciente, type DatosHallazgo } from './util';

/** Minutos de prerrespiración de oxígeno por debajo de los cuales se avisa (provisional). */
export const PRERRESPIRACION_MIN = 120;

/** Protocolo actual ante síntomas de descompresión (§7.1.4, textual). */
const PROTOCOLO_DCS = 'Termina la caminata de forma segura pero rápida y vuelve a la nave presurizada.';

/** Ventana de riesgo de descompresión: durante la EVA o hasta 24 h después de la última telemetría del traje. */
function ventanaEva(h: Historial, ahora: number, c: Contexto): { activa: boolean; enEva: boolean; ultimaEva?: Lectura } {
  const ultimaEva = ultimaReciente(h, 'duracionEva', ahora, 24);
  const enEva = c.ubicacion === 'eva';
  return { activa: enEva || !!ultimaEva, enEva, ultimaEva };
}

export const reglaDescompresion = definirRegla(
  {
    id: 'descompresion.eva', nombre: 'Enfermedad por descompresión', sistema: 'cuerpo',
    sensores: ['sxDolorArticular', 'sxDisnea', 'sxNeurologico', 'prerrespiracion', 'duracionEva'],
    fuente: '§7.1.4 Enfermedad por descompresión: dolor articular, falta de aire, síntomas similares a un ACV; prerrespiración de oxígeno',
    hrp: ['descompresion', 'eva'],
  },
  (h, p, ahora, c) => {
    const v = ventanaEva(h, ahora, c);
    // Fuera de la ventana los mismos síntomas los interpretan otras reglas.
    if (!v.activa) return null;
    const pre = ultimaReciente(h, 'prerrespiracion', ahora, 12);
    const articular = ultimaReciente(h, 'sxDolorArticular', ahora, 12);
    const disnea = ultimaReciente(h, 'sxDisnea', ahora, 12);
    const neuro = ultimaReciente(h, 'sxNeurologico', ahora, 12);
    const datos = datosDe(p, v.ultimaEva, pre, articular, disnea, neuro);
    const momento = v.enEva ? 'durante la EVA' : `${r1((ahora - v.ultimaEva!.timestamp) / HORA)} h después de la EVA`;
    const partes = [
      momento,
      pre && `prerrespiración ${pre.valor} min${pre.valor < PRERRESPIRACION_MIN ? ` (menos de ${PRERRESPIRACION_MIN})` : ''}`,
      articular && articular.valor > 0 && `dolor articular ${articular.valor}/10`,
      disnea && disnea.valor > 0 && `falta de aire ${disnea.valor}/10`,
      neuro && neuro.valor > 0 && `síntomas neurológicos ${neuro.valor}/10`,
    ].filter(Boolean);
    const detalle = partes.join(' · ');
    const grave = (disnea?.valor ?? 0) >= 4 || (neuro?.valor ?? 0) >= 3;
    const dolor = articular?.valor ?? 0;
    const corta = !!pre && pre.valor < PRERRESPIRACION_MIN;
    const nivel: Nivel = grave || dolor >= 6 ? 'alerta' : dolor >= 3 || corta ? 'aviso' : 'normal';
    if (nivel === 'normal') return { ...normal('Descompresión', detalle), datos };

    const accionHabitat = 'Quédate en reposo, respira oxígeno si está disponible y avisa al equipo: puede requerir la cámara hiperbárica o la presurización del traje.';
    if (nivel === 'aviso' && dolor < 3) {
      return {
        nivel, titulo: 'Prerrespiración incompleta', detalleTecnico: detalle, datos,
        resumenSimple: 'Respiraste oxígeno menos tiempo del recomendado antes de salir: hay más riesgo de descompresión.',
        accion: 'Avisa ya a Higia si sientes dolor en las articulaciones, falta de aire u hormigueo.',
        accionPorUbicacion: { eva: 'Mantén un ritmo moderado y avisa a Higia si notas dolor en las articulaciones, falta de aire u hormigueo.' },
        ruta: 'reporte', sensible: false, bloquea: ['ejercicioIntenso'],
      };
    }
    const d: DatosHallazgo = {
      nivel, detalleTecnico: detalle, datos,
      titulo: grave ? 'Posible descompresión grave' : 'Posible enfermedad por descompresión',
      region: grave ? 'craneo' : 'brazos',
      resumenSimple: grave
        ? 'Tus síntomas pueden ser burbujas de nitrógeno afectando la respiración o el sistema nervioso.'
        : 'El dolor en las articulaciones tras bajar la presión puede ser descompresión.',
      accion: v.enEva ? PROTOCOLO_DCS : accionHabitat,
      accionPorUbicacion: { eva: PROTOCOLO_DCS },
      ruta: 'reporte', sensible: false, bloquea: ['eva', 'ejercicioIntenso'],
    };
    if (nivel === 'alerta') {
      d.posibleIncapacidad = grave || undefined;
      d.pasos = [
        v.enEva ? 'Avisa a tu compañero y termina la caminata de forma segura pero rápida.' : 'Quédate en reposo y no hagas fuerza.',
        v.enEva ? 'Vuelve a la nave presurizada por el camino más corto.' : 'Respira oxígeno al 100 % si está disponible.',
        'No te frotes ni masajees las articulaciones que duelen.',
        'Bebe agua si puedes tragar bien.',
        'Si aparecen debilidad de un lado, dificultad para hablar o falta de aire, un compañero debe asistirte.',
        'El equipo debe evaluar la presurización del traje o la cámara hiperbárica.',
      ];
    }
    return d;
  },
);

// ── Carga física durante la EVA ────────────────────────────────────────

/** La caminata más larga duró 8 h 56 min (§7.1.8). */
export const DURACION_EVA = { aviso: 360, alerta: 480 };

export const reglaCargaEva = definirRegla(
  {
    id: 'eva.carga', nombre: 'Carga física en la EVA', sistema: 'musculos',
    sensores: ['duracionEva', 'frecuenciaCardiaca', 'temperatura'],
    fuente: '§7.1.8 Lesiones y rendimiento en EVA (récord de 8 h 56 min) · monitoreo biomédico del traje',
    hrp: ['eva', 'aptitud'],
  },
  (h, p, ahora, c) => {
    if (c.ubicacion !== 'eva') return null;
    const dur = ultimaReciente(h, 'duracionEva', ahora, 12);
    const fcs = recientes(h, 'frecuenciaCardiaca', ahora, 0.5);
    const temp = ultimaReciente(h, 'temperatura', ahora, 1);
    // FC sostenida: todas las lecturas de los últimos 20 min ≥ 150, y la primera de hace al menos 20 min.
    const ventana = fcs.filter((l) => l.timestamp >= ahora - 25 * MINUTO);
    const sostenida = ventana.length >= 2 && ventana.every((l) => l.valor >= 150) && ahora - ventana[0].timestamp >= 20 * MINUTO;
    const calor = !!temp && temp.valor >= 38.5;
    if (!dur && !sostenida && !calor) return null;
    const datos = [...datosDe(p, dur, temp), ...(sostenida ? ventana.map((l) => dato(l, p)) : [])];
    const partes = [
      dur && `EVA de ${Math.floor(dur.valor / 60)} h ${Math.round(dur.valor % 60)} min`,
      sostenida && `FC ≥150 lpm sostenida ${Math.round((ahora - ventana[0].timestamp) / MINUTO)} min`,
      calor && `temperatura ${r1(temp!.valor)} °C en el traje`,
    ].filter(Boolean);
    const detalle = partes.join(' · ');
    const larga = dur ? (dur.valor > DURACION_EVA.alerta ? 'alerta' : dur.valor > DURACION_EVA.aviso ? 'aviso' : 'normal') : 'normal';
    const nivel: Nivel = calor || larga === 'alerta' ? 'alerta' : sostenida || larga === 'aviso' ? 'aviso' : 'normal';
    if (nivel === 'normal') return { ...normal('Carga en la EVA', detalle), datos };

    const titulo = calor ? 'Posible golpe de calor en el traje' : larga === 'alerta' ? 'EVA demasiado larga' : sostenida ? 'Sobreesfuerzo en la EVA' : 'EVA larga';
    const d: DatosHallazgo = {
      nivel, titulo, detalleTecnico: detalle, datos,
      resumenSimple: calor ? 'Tu cuerpo se está calentando demasiado dentro del traje.' : sostenida ? 'Llevas un rato con el corazón muy acelerado.' : 'Llevas muchas horas fuera: el cansancio aumenta el riesgo de errores y lesiones.',
      accion: calor
        ? 'Sube el enfriamiento del traje al máximo, detén la tarea y regresa a la esclusa con tu compañero.'
        : 'Baja el ritmo, haz pausas cortas y planifica el regreso con tu compañero.',
      ruta: nivel === 'alerta' ? 'reporte' : 'autogestion', sensible: false,
    };
    if (nivel === 'alerta') {
      d.posibleIncapacidad = calor || undefined;
      d.pasos = calor
        ? [
            'Detén la tarea y asegúrate al arnés.',
            'Sube el enfriamiento del traje al máximo.',
            'Bebe de la bolsa de agua del traje.',
            'Avisa a tu compañero y regresa a la esclusa con él.',
            'Si te mareas o te confundes, tu compañero debe guiarte.',
          ]
        : [
            'Termina la tarea en curso de forma segura y no empieces otra.',
            'Revisa el oxígeno y la batería del traje.',
            'Bebe y come lo que tengas en el traje.',
            'Regresa a la esclusa con tu compañero.',
          ];
    }
    return d;
  },
);
