// AVISO: UMBRALES PROVISIONALES: validar con el equipo médico y con §7.1.1, §7.1.5 y §8.3 antes de la demo.
// Sistema inmune y microorganismos: fiebre, reactivación de virus latentes y carga microbiana del entorno.
import type { Historial } from '../historial';
import type { DatoClinico, Lectura, Nivel } from '../tipos';
import { dato, datosDe, definirRegla, factor, HORA, normal, r1, recientes, subirNivel, ultimaReciente, type DatosHallazgo } from './util';

// ── Fiebre ─────────────────────────────────────────────────────────────

export const FIEBRE = { febricula: 37.5, fiebre: 38, alta: 39, hipotermia: 35 };

/** La fiebre lleva al menos 24 h sin bajar de `umbral` (todas las lecturas desde entonces la superan). */
function fiebreSostenida(h: Historial, ahora: number, umbral: number): Lectura[] | null {
  const ls = recientes(h, 'temperatura', ahora, 48);
  const tramo: Lectura[] = [];
  for (let i = ls.length - 1; i >= 0 && ls[i].valor >= umbral; i--) tramo.unshift(ls[i]);
  return tramo.length >= 2 && ahora - tramo[0].timestamp >= 24 * HORA ? tramo : null;
}

export const reglaFiebre = definirRegla(
  {
    id: 'inmune.fiebre', nombre: 'Temperatura corporal', sistema: 'inmune',
    sensores: ['temperatura'],
    fuente: '§7.1.1 Respuesta inmune alterada · §8.3 Inmunidad alterada (contagio entre tripulantes) · Anexo F: temperatura',
    hrp: ['inmune', 'microorganismos'],
  },
  (h, p, ahora, c) => {
    const ult = ultimaReciente(h, 'temperatura', ahora, 24);
    if (!ult) return null;
    const t = ult.valor;
    // En esfuerzo (ejercicio o EVA) sube la temperatura sin que sea fiebre.
    const esfuerzo = c.actividad === 'ejercicio' || c.ubicacion === 'eva';
    const tol = esfuerzo ? 0.5 : 0;
    const sostenida = fiebreSostenida(h, ahora, FIEBRE.fiebre + tol);
    const alergias = p.historiaClinica.alergias;
    const detalle = `Temperatura ${r1(t)} °C${esfuerzo ? ' · en esfuerzo físico (+0,5 °C de tolerancia)' : ''}` +
      `${sostenida ? ` · por encima de ${FIEBRE.fiebre} °C desde hace ${Math.round((ahora - sostenida[0].timestamp) / HORA)} h` : ''}`;
    const datos = sostenida ? sostenida.map((l) => dato(l, p)) : undefined;
    const aislar = 'Mantén distancia del resto de la tripulación y no compartas utensilios: una infección puede contagiarse en la nave.';
    const antitermico = alergias.length
      ? `Si el protocolo indica un antitérmico, revisa tus alergias antes: ${alergias.join(', ')}.`
      : 'Si el protocolo indica un antitérmico, tómalo según el botiquín.';

    if (t < FIEBRE.hipotermia) {
      return {
        nivel: 'alerta', titulo: 'Temperatura corporal muy baja', detalleTecnico: detalle, datos,
        resumenSimple: 'Tu cuerpo está demasiado frío.',
        accion: 'Abrígate, busca un lugar templado y avisa a un compañero.',
        accionPorUbicacion: { eva: 'Revisa la calefacción del traje y regresa a la esclusa con tu compañero.' },
        pasos: [
          'Ve a un lugar templado y quítate la ropa húmeda si la hay.',
          'Abrígate con mantas, cubriendo también la cabeza.',
          'Bebe algo tibio si estás bien despierto.',
          'Vuelve a medir la temperatura en 15 minutos.',
          'Si aparecen confusión, torpeza o mucho sueño, un compañero debe quedarse contigo.',
        ],
        posibleIncapacidad: true, ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje', 'ejercicioIntenso'],
      };
    }
    if (t >= FIEBRE.alta + tol || sostenida) {
      return {
        nivel: 'alerta', titulo: sostenida && t < FIEBRE.alta + tol ? 'Fiebre que no baja' : 'Fiebre alta', detalleTecnico: detalle, datos,
        resumenSimple: sostenida && t < FIEBRE.alta + tol ? 'Llevas más de un día con fiebre.' : 'Tienes fiebre alta.',
        accion: `Descansa, hidrátate y aíslate del resto. ${antitermico}`,
        pasos: [
          'Detén la actividad física y descansa en tu compartimento.',
          aislar,
          'Bebe agua o solución con electrolitos: al menos un vaso cada hora.',
          antitermico,
          'Vuelve a medir la temperatura en 2 horas.',
          'Si aparecen confusión, rigidez de cuello, manchas en la piel o falta de aire, avisa de inmediato.',
        ],
        ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje', 'ejercicioIntenso'],
      };
    }
    if (t >= FIEBRE.fiebre + tol) {
      return {
        nivel: 'aviso', titulo: 'Fiebre', detalleTecnico: detalle, datos,
        resumenSimple: 'Tienes fiebre: tu cuerpo puede estar combatiendo una infección.',
        accion: `${aislar} Hidrátate y vuelve a medir en 2 horas.`,
        ruta: 'reporte', sensible: false, bloquea: ['eva', 'ejercicioIntenso'],
      };
    }
    if (t >= FIEBRE.febricula + tol) {
      return {
        nivel: 'info', titulo: 'Temperatura algo elevada', detalleTecnico: detalle,
        resumenSimple: 'Tu temperatura está un poco alta.',
        accion: 'Hidrátate y vuelve a medir en 2 horas.', ruta: 'autogestion', sensible: false,
      };
    }
    return normal('Temperatura', detalle);
  },
);

// ── Reactivación de virus latentes y alergias atípicas ─────────────────

export const reglaReactivacion = definirRegla(
  {
    id: 'inmune.reactivacion', nombre: 'Señales de defensas alteradas', sistema: 'inmune',
    sensores: ['sxPiel', 'sxAlergia', 'horasSueno', 'estres', 'dosisRadiacion'],
    fuente: '§7.1.1 Respuesta inmune alterada (herpes labial, erupciones, alergias atípicas) · §8.3 Inmunidad alterada · Immune Biomarkers',
    hrp: ['inmune'],
  },
  (h, p, ahora) => {
    const piel = ultimaReciente(h, 'sxPiel', ahora, 72);
    const alergia = ultimaReciente(h, 'sxAlergia', ahora, 72);
    // Sin síntoma no se evalúa: el factor solo (dormir poco, estrés) no es el problema.
    if (!piel && !alergia) return null;
    const sx = Math.max(piel?.valor ?? 0, alergia?.valor ?? 0);
    const f = factor(h, p, ahora);
    const agravantes = [f.suenoBajo, f.estresAlto, f.dosisAlta].filter((x) => x.activo);
    const datos: DatoClinico[] = [...datosDe(p, piel, alergia), ...agravantes.flatMap((a) => a.datos)];
    const queSx = [piel && piel.valor > 0 && `lesiones de piel ${piel.valor}/10`, alergia && alergia.valor > 0 && `síntomas de alergia ${alergia.valor}/10`].filter(Boolean);
    const detalle = `${queSx.join(' · ') || 'sin síntomas'}${agravantes.length ? ` · factores que bajan las defensas: ${agravantes.map((a) => a.texto).join(', ')}` : ''}`;

    let nivel: Nivel = sx >= 6 ? 'alerta' : sx >= 3 ? 'aviso' : 'normal';
    if (nivel !== 'normal' && agravantes.length) nivel = subirNivel(nivel);
    if (nivel === 'normal') return { ...normal('Defensas', detalle), datos };

    const esPiel = (piel?.valor ?? 0) >= (alergia?.valor ?? 0);
    const base: DatosHallazgo = {
      nivel, titulo: esPiel ? 'Posible reactivación de un virus latente' : 'Alergia atípica', detalleTecnico: detalle, datos,
      region: esPiel ? 'cara' : undefined,
      resumenSimple: esPiel
        ? 'Lo que notas en la piel puede ser un virus que se despierta cuando las defensas bajan (como el herpes labial).'
        : 'Tus síntomas de alergia son poco habituales: en el espacio las defensas cambian.',
      accion: esPiel
        ? 'No compartas utensilios ni toallas, toma una foto de la lesión para el registro y avisa al cirujano de vuelo.'
        : 'Anota cuándo empezó y qué estabas haciendo, y avisa al cirujano de vuelo. Revisa si hay polvo o un producto nuevo cerca.',
      ruta: 'reporte', sensible: false,
    };
    if (nivel === 'alerta') {
      base.pasos = esPiel
        ? [
            'No toques ni revientes las ampollas; lávate las manos después de tocar la zona.',
            'No compartas utensilios, toallas ni el equipo de comunicación.',
            'Toma una foto de la lesión con luz y la misma distancia cada día.',
            'Si aparece en un ojo o cerca de él, o tienes fiebre, avísalo de inmediato.',
            'Prioriza dormir: el descanso ayuda a las defensas.',
          ]
        : [
            'Aléjate de la zona donde empezaron los síntomas.',
            'Si tienes dificultad para respirar o se te hinchan los labios o la lengua, pide ayuda de inmediato.',
            'Usa el antihistamínico del botiquín si el protocolo lo indica.',
            'Anota el momento y lo que estabas haciendo.',
          ];
    }
    return base;
  },
);
