// AVISO: UMBRALES PROVISIONALES: validar contra los Anexos B, C y F antes de la demo.
// Salud mental: todo hallazgo es `sensible`, así que nunca va a una pantalla compartida.
import { promedio } from '../historial';
import type { Nivel } from '../tipos';
import { dato, DIA, definirRegla, normal, porDia, r1, ultimaReciente, type DatosHallazgo } from './util';

export const reglaSueno = definirRegla(
  {
    id: 'sueno.deficit', nombre: 'Déficit de sueño', sistema: 'cerebro',
    sensores: ['horasSueno'],
    fuente: 'Anexo F: horas de sueño, actigrafía · Anexo B: sueño y ritmo circadiano',
    hrp: ['sueno'],
  },
  (h) => {
    const noches = h.ultimas('horasSueno', 3);
    if (!noches.length) return null;
    const datos = noches.map((n) => ({ sensor: n.sensor, valor: n.valor, timestamp: n.timestamp, fuente: n.fuente }));
    const media = r1(promedio(noches.map((n) => n.valor)));
    const detalle = `Promedio de ${media} h en las últimas ${noches.length} noches`;
    const accion = 'Esta noche: luz tenue una hora antes de dormir, nada de cafeína después del mediodía y mantén tu horario.';

    if (media < 6) {
      return {
        nivel: 'aviso', titulo: 'Déficit de sueño acumulado', detalleTecnico: detalle,
        resumenSimple: 'Estás durmiendo bastante menos de lo que necesitas.',
        accion, ruta: 'autogestion', sensible: false, datos,
        // Con menos de 5 h de promedio, la atención no alcanza para pilotear con seguridad.
        bloquea: media < 5 ? ['pilotaje'] : undefined,
      };
    }
    if (media < 7) {
      return {
        nivel: 'info', titulo: 'Sueño algo corto', detalleTecnico: detalle,
        resumenSimple: 'Has dormido un poco menos de lo ideal.',
        accion, ruta: 'autogestion', sensible: false, datos,
      };
    }
    return { ...normal('Sueño', detalle), datos };
  },
);

export const reglaAnimo = definirRegla(
  {
    id: 'mental.animo', nombre: 'Estado de ánimo', sistema: 'cerebro',
    sensores: ['animo'],
    fuente: 'Anexo F: encuestas de ánimo · Anexo B: salud conductual por aislamiento y confinamiento',
    hrp: ['conductual'],
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
        pasos: [
          'Busca un momento tranquilo y un lugar con privacidad.',
          'Habla con alguien de confianza de la tripulación, o pide a Higia una conversación con el psicólogo de la misión.',
          'Escribe en tu diario cómo te sientes hoy.',
          'Mantén tus horarios de sueño, comida y ejercicio.',
          'Si aparecen ideas de hacerte daño, díselo a Higia o a un compañero de inmediato.',
        ],
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
    hrp: ['conductual'],
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

// ── Ánimo bajo sostenido ───────────────────────────────────────────────

export const reglaAnimoSostenido = definirRegla(
  {
    id: 'mental.animoSostenido', nombre: 'Ánimo bajo sostenido', sistema: 'cerebro',
    sensores: ['animo'],
    fuente: '§7.2.1 Cambios conductuales y trastornos psiquiátricos (ansiedad, depresión por aislamiento) · autocuidado: diario, jardinería',
    hrp: ['conductual'],
  },
  (h, p, ahora, c) => {
    const base = p.lineaBase.animo ?? 7;
    const bajo = (v: number) => v <= base - 2;
    const d14 = porDia(h, 'animo', ahora, 14);
    // Con menos de cinco días registrados no hay tendencia que evaluar.
    if (d14.length < 5) return null;
    const d7 = d14.filter((d) => d.dia > ahora - 7 * DIA);
    const bajos7 = d7.filter((d) => bajo(d.valor)).length;
    const bajos14 = d14.filter((d) => bajo(d.valor)).length;
    const datos = d14.slice(-7).map((d) => dato(d.lecturas.at(-1)!, p));
    const detalle = `${bajos7} de los últimos ${d7.length} días y ${bajos14} de ${d14.length} con ánimo 2 o más puntos bajo tu línea base (${base})`;
    const nivel: Nivel = bajos14 >= 10 ? 'alerta' : bajos7 >= 5 ? 'aviso' : 'normal';
    if (nivel === 'normal') return { ...normal('Ánimo de las últimas semanas', detalle, true), datos };
    // Sin enlace con Tierra no se promete una llamada: autocuidado a bordo (§7.2.1).
    const sinTierra = !c.conexionTierra;
    const autocuidado = sinTierra
      ? 'Escribe en tu diario, dedica un rato al jardín o a mirar por la ventana, y habla con un compañero de confianza.'
      : 'Agenda una conversación con el psicólogo de la misión o con tu familia, y reserva un rato para ti cada día.';
    const d: DatosHallazgo = {
      nivel, detalleTecnico: detalle, datos,
      titulo: nivel === 'alerta' ? 'Ánimo bajo durante semanas' : 'Varios días con el ánimo bajo',
      resumenSimple: 'Llevas varios días sintiéndote más bajo de lo habitual.',
      textoCalmado: 'Estos días están siendo pesados. Es comprensible, y hay cosas que pueden ayudar.',
      accion: autocuidado,
      ruta: nivel === 'alerta' ? 'reporte' : 'autogestion', sensible: true,
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'No tienes que resolverlo solo: elige a una persona de la tripulación en quien confíes y cuéntale cómo estás.',
        sinTierra ? 'Escribe en tu diario lo que sientes: ayuda a ordenar las ideas.' : 'Pide una conversación con el psicólogo de la misión; Higia puede enviar el pedido.',
        'Mantén tus horarios de sueño y de comida, aunque no tengas ganas.',
        'Dedica un rato al jardín, a la ventana o a algo que te guste.',
        'Si aparecen ideas de hacerte daño, díselo a Higia o a un compañero de inmediato.',
      ];
    }
    return d;
  },
);

// ── Trabajo en equipo ──────────────────────────────────────────────────

export const reglaCohesion = definirRegla(
  {
    id: 'equipo.cohesion', nombre: 'Convivencia y trabajo en equipo', sistema: 'cerebro',
    sensores: ['cohesionEquipo'],
    fuente: '§7.2.2 Trabajo en equipo inadecuado · ARCHeR: encuestas de interacción de la tripulación',
    hrp: ['equipo'],
  },
  (h, p, ahora) => {
    const ult = ultimaReciente(h, 'cohesionEquipo', ahora, 14 * 24);
    if (!ult) return null;
    const base = p.lineaBase.cohesionEquipo ?? 8;
    const caida = base - ult.valor;
    const detalle = `Cohesión del equipo ${ult.valor}/10 (línea base ${base})`;
    const nivel: Nivel = ult.valor <= 3 ? 'alerta' : ult.valor <= 5 || caida >= 3 ? 'aviso' : 'normal';
    if (nivel === 'normal') return normal('Convivencia', detalle, true);
    const d: DatosHallazgo = {
      nivel, detalleTecnico: detalle,
      titulo: nivel === 'alerta' ? 'Tensión fuerte en la tripulación' : 'Tensión en la tripulación',
      resumenSimple: 'La convivencia con el equipo está costando más de lo habitual.',
      textoCalmado: 'Convivir tanto tiempo en poco espacio es difícil para cualquiera.',
      accion: 'Tómate una pausa antes de hablar del tema. Propón una conversación guiada y una actividad en común.',
      ruta: nivel === 'alerta' ? 'reporte' : 'autogestion', sensible: true,
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'Si la discusión está encendida, toma distancia unos minutos en otro módulo.',
        'Respira lento y espera a estar tranquilo antes de volver a hablar.',
        'Propón una conversación guiada: cada uno habla sin interrupciones, con un tiempo acordado.',
        'Busquen una tarea o una comida en común para retomar el trato.',
        'Si sigue la tensión, Higia puede pedir apoyo al psicólogo de la misión.',
      ];
    }
    return d;
  },
);

// ── Ritmo circadiano ───────────────────────────────────────────────────

export const reglaCircadiano = definirRegla(
  {
    id: 'sueno.circadiano', nombre: 'Desfase del reloj biológico', sistema: 'cerebro',
    sensores: ['desfaseCircadiano'],
    fuente: '§7.2.3 Sueño y horarios irregulares (16 amaneceres por día en la ISS; luz y cafeína) · ARCHeR: actigrafía',
    hrp: ['sueno'],
  },
  (h, p, ahora) => {
    const ult = ultimaReciente(h, 'desfaseCircadiano', ahora, 72);
    if (!ult) return null;
    const detalle = `Horario de sueño corrido ${ult.valor} h respecto de tu horario habitual (${p.horarioSueno.inicio}:00 a ${p.horarioSueno.fin}:00)`;
    const nivel: Nivel = ult.valor >= 4 ? 'alerta' : ult.valor >= 2 ? 'aviso' : 'normal';
    if (nivel === 'normal') return normal('Reloj biológico', detalle);
    const accion = 'Luz intensa al despertar, luz tenue una hora antes de dormir y nada de cafeína después del mediodía.';
    const d: DatosHallazgo = {
      nivel, titulo: nivel === 'alerta' ? 'Reloj biológico muy desfasado' : 'Reloj biológico desfasado', detalleTecnico: detalle,
      resumenSimple: 'Tu horario de sueño se corrió: el cuerpo no sabe bien cuándo es de día.',
      accion, ruta: 'autogestion', sensible: false,
    };
    if (nivel === 'alerta') {
      d.bloquea = ['pilotaje'];
      d.pasos = [
        'Al despertar, enciende la luz más intensa del módulo (modo día de las luces LED) durante 30 minutos.',
        'Una hora antes de dormir, baja la luz y deja las pantallas.',
        'Sin cafeína después del mediodía.',
        'Acuéstate y levántate a la misma hora durante los próximos tres días.',
        'Evita tareas críticas en las primeras horas después de despertar.',
      ];
    }
    return d;
  },
);

// ── Sobrecarga de trabajo ──────────────────────────────────────────────

export const reglaSobrecarga = definirRegla(
  {
    id: 'trabajo.sobrecarga', nombre: 'Sobrecarga de trabajo', sistema: 'cerebro',
    sensores: ['horasTrabajo'],
    fuente: '§7.2.3: sobrecarga de trabajo; tiempo asignado de relajación para prevenir el burnout',
    hrp: ['sueno', 'conductual'],
  },
  (h, p, ahora) => {
    const dias = porDia(h, 'horasTrabajo', ahora, 5, (xs) => xs[xs.length - 1]);
    if (dias.length < 3) return null;
    const mas12 = dias.filter((d) => d.valor > 12).length;
    const mas10 = dias.filter((d) => d.valor > 10).length;
    const datos = dias.map((d) => dato(d.lecturas.at(-1)!, p));
    const detalle = `${mas10} de los últimos ${dias.length} días con más de 10 h de trabajo (${dias.map((d) => d.valor).join(', ')} h)`;
    const nivel: Nivel = mas12 >= 3 ? 'alerta' : mas10 >= 3 ? 'aviso' : 'normal';
    if (nivel === 'normal') return { ...normal('Carga de trabajo', detalle), datos };
    const d: DatosHallazgo = {
      nivel, titulo: nivel === 'alerta' ? 'Sobrecarga de trabajo sostenida' : 'Jornadas muy largas', detalleTecnico: detalle, datos,
      resumenSimple: 'Llevas varios días trabajando muchas horas: así aparece el agotamiento.',
      accion: 'Respeta el tiempo de relajación de la rutina y pide al comandante redistribuir tareas.',
      ruta: nivel === 'alerta' ? 'reporte' : 'autogestion', sensible: false,
    };
    if (nivel === 'alerta') {
      d.pasos = [
        'Hoy termina tu jornada a la hora prevista, aunque queden tareas.',
        'Usa el tiempo de relajación asignado: no lo cambies por trabajo.',
        'Habla con el comandante para redistribuir las tareas de los próximos días.',
        'Duerme al menos 7 horas esta noche.',
      ];
    }
    return d;
  },
);
