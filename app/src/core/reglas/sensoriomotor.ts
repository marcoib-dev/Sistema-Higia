// AVISO: UMBRALES PROVISIONALES: validar con el equipo médico y kinesiología, y con §7.1.2, antes de la demo.
// Sensoriomotor y vestibular: cinetosis y equilibrio. Ambos contraindican EVA y pilotaje.
import type { Nivel } from '../tipos';
import { caidaRelativa, datosDe, DIA, definirRegla, normal, pct, ultimaReciente, type DatosHallazgo } from './util';

export const reglaCinetosis = definirRegla(
  {
    id: 'vestibular.cinetosis', nombre: 'Mareo por movimiento (cinetosis)', sistema: 'oidoInterno',
    sensores: ['sxMareo', 'sxNauseas'],
    fuente: '§7.1.2 Función sensoriomotora y vestibular · Artemis II Standard Measures: síntomas de cinetosis',
    hrp: ['sensoriomotor'],
  },
  (h, p, ahora, c) => {
    const mareo = ultimaReciente(h, 'sxMareo', ahora, 12);
    const nauseas = ultimaReciente(h, 'sxNauseas', ahora, 12);
    if (!mareo && !nauseas) return null;
    const datos = datosDe(p, mareo, nauseas);
    const sx = Math.max(mareo?.valor ?? 0, nauseas?.valor ?? 0);
    const fuera = c.ubicacion === 'eva' || c.ubicacion === 'rover';
    let nivel: Nivel = sx >= 8 ? 'alerta' : sx >= 5 ? 'aviso' : sx >= 3 ? 'info' : 'normal';
    // Vomitar dentro del casco es peligroso; marearse al volante del rover, también.
    if (fuera && nivel === 'aviso') nivel = 'alerta';
    const partes = [mareo && `mareo ${mareo.valor}/10`, nauseas && `náuseas ${nauseas.valor}/10`].filter(Boolean);
    const detalle = `${partes.join(' · ')}${c.transicionGravedad ? ' · transición de gravedad reciente' : ''}${fuera ? ` · ${c.ubicacion === 'eva' ? 'en EVA' : 'en el rover'}` : ''}`;
    if (nivel === 'normal') return { ...normal('Mareo', detalle), datos };

    const accion = c.transicionGravedad
      ? 'Mueve la cabeza despacio, fija la vista en un punto quieto y toma la medicación para el mareo según el protocolo.'
      : 'Quédate quieto unos minutos con la vista fija en un punto, respira lento y bebe agua a sorbos.';
    const d: DatosHallazgo = {
      nivel, titulo: nivel === 'alerta' && fuera ? 'Mareo fuera del hábitat' : 'Mareo por movimiento', detalleTecnico: detalle, datos,
      region: 'craneo',
      resumenSimple: c.transicionGravedad
        ? 'Es esperable marearse al cambiar de gravedad: le pasa a la mayoría de los astronautas.'
        : 'Te estás mareando; el oído interno se está adaptando.',
      textoCalmado: 'Es normal que el cuerpo se tome un tiempo para adaptarse. Vamos con calma.',
      accion,
      accionPorUbicacion: {
        eva: 'Detén la tarea, asegúrate al arnés y vuelve a la esclusa con tu compañero: vomitar dentro del casco es peligroso.',
        rover: 'Detén el rover en un lugar seguro y no sigas manejando hasta que se pase.',
      },
      ruta: nivel === 'alerta' ? 'reporte' : 'autogestion', sensible: false,
      bloquea: nivel === 'info' ? undefined : ['eva', 'pilotaje'],
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'Detén lo que estás haciendo. Si estás fuera, asegúrate al arnés o detén el rover.',
        'Fija la vista en un punto quieto y mueve la cabeza lo menos posible.',
        'Si estás en EVA, avisa a tu compañero y regresa a la esclusa con él.',
        'Si vas a vomitar con el casco puesto, avisa de inmediato: tu compañero debe ayudarte a volver.',
        'Ya en el hábitat, toma la medicación para el mareo según el protocolo y bebe a sorbos.',
      ];
    }
    return d;
  },
);

export const reglaEquilibrio = definirRegla(
  {
    id: 'vestibular.equilibrio', nombre: 'Prueba de equilibrio', sistema: 'oidoInterno',
    sensores: ['equilibrio'],
    fuente: '§7.1.2 Sensoriomotor y vestibular · §7.1.9 riesgo de caídas en las transiciones · Standard Measures: pruebas sensoriomotoras',
    hrp: ['sensoriomotor', 'cargasDinamicas'],
  },
  (h, p, ahora, c) => {
    const ult = ultimaReciente(h, 'equilibrio', ahora, 14 * 24);
    if (!ult) return null;
    const base = p.lineaBase.equilibrio ?? 90;
    const caida = caidaRelativa(ult.valor, base);
    const detalle = `Equilibrio ${ult.valor}/100 (línea base ${base}, ${caida > 0 ? '−' : '+'}${pct(Math.abs(caida))})` +
      `${c.transicionGravedad ? ' · transición de gravedad reciente' : ''}` +
      `${ahora - ult.timestamp > DIA ? ` · prueba de hace ${Math.round((ahora - ult.timestamp) / DIA)} días` : ''}`;
    const accion = 'Muévete con apoyo de ambas manos, sin giros rápidos, y repite la prueba de equilibrio en 24 h.';

    if (caida >= 0.4) {
      return {
        nivel: 'alerta', titulo: 'Equilibrio muy alterado', detalleTecnico: detalle,
        resumenSimple: 'Tu equilibrio está bastante peor que de costumbre: hay riesgo de caídas.',
        accion,
        pasos: [
          'No manejes el rover ni salgas a EVA hasta repetir la prueba.',
          'Muévete despacio, siempre con apoyo de ambas manos.',
          'Evita escaleras, escotillas y giros de cabeza rápidos.',
          'Pide a un compañero que te acompañe en los traslados.',
          'Repite la prueba de equilibrio en 24 h.',
        ],
        ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje'],
      };
    }
    if (caida >= 0.2) {
      return {
        nivel: 'aviso', titulo: 'Equilibrio más bajo de lo habitual', detalleTecnico: detalle,
        resumenSimple: 'Tu equilibrio está algo peor que de costumbre.',
        accion, ruta: 'autogestion', sensible: false, bloquea: ['eva', 'pilotaje'],
      };
    }
    return normal('Equilibrio', detalle);
  },
);
