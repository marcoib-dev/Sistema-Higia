// AVISO: UMBRALES PROVISIONALES: validar con el equipo médico y con los Anexos B y F antes de la demo.
// Neurología y salud mental: traumatismo craneal, desorientación / deterioro cognitivo y posibles
// síntomas psicóticos. Higia no diagnostica: detecta señales, las comunica con calma y avisa a quien
// corresponde. Cada hallazgo deja registrados los datos exactos en que se basó.
import { promedio } from '../historial';
import { dato, datosDe, definirRegla, normal, r1, ultimaReciente } from './util';

// ── Traumatismo craneal ────────────────────────────────────────────────

/** Umbrales del pico de aceleración en la cabeza (g). */
export const IMPACTO = { leve: 8, golpe: 15, grave: 40 };

export const reglaTraumaCraneal = definirRegla(
  {
    id: 'trauma.craneal', nombre: 'Traumatismo craneal', sistema: 'cerebro',
    sensores: ['impactoCabeza', 'orientacion'],
    fuente: 'Anexo B: lesiones y traumatismos en misión · Acelerómetro del casco y chequeo de orientación',
    hrp: ['cargasDinamicas', 'eva'],
  },
  (h, p, ahora, c) => {
    const impacto = ultimaReciente(h, 'impactoCabeza', ahora, 24);
    if (!impacto) return null;
    // La orientación cuenta solo si se midió después del golpe.
    const orientacion = h.desde('orientacion', impacto.timestamp).at(-1);
    const datos = datosDe(p, impacto, orientacion);
    const g = impacto.valor;
    const desorientado = orientacion !== undefined && orientacion.valor <= 7;
    const detalle = `Impacto de ${g} g en la cabeza${orientacion ? ` · orientación ${orientacion.valor}/10 después del golpe` : ' · orientación aún sin evaluar'}`;
    const vigilar = 'Durante 24 h vigila dolor de cabeza que empeora, vómitos, visión doble, somnolencia o confusión.';

    if (g >= IMPACTO.grave || (g >= IMPACTO.golpe && desorientado)) {
      return {
        nivel: 'alerta', titulo: 'Posible traumatismo craneoencefálico', detalleTecnico: detalle, datos, region: 'craneo',
        resumenSimple: 'Recibiste un golpe fuerte en la cabeza.',
        textoCalmado: 'Recibiste un golpe en la cabeza. Quédate quieto, la ayuda está en camino.',
        accion: 'No te muevas bruscamente ni te quites el casco. Higia avisa a tu compañero y te hará preguntas de orientación.',
        accionPorUbicacion: { eva: 'Detén la EVA, asegúrate al arnés y no te quites el casco. Tu compañero debe acompañarte de regreso al hábitat.' },
        pasos: [
          'No te muevas bruscamente. Si te duele el cuello, no lo muevas y espera ayuda.',
          'No te quites el casco hasta estar en un lugar seguro y presurizado.',
          'Responde las preguntas de orientación de Higia: ayudan a saber si el golpe te afectó.',
          'Un compañero debe revisar tus pupilas, tu habla y si recuerdas lo que pasó.',
          vigilar,
          'No duermas solo ni hagas tareas de riesgo hasta que te evalúe el médico.',
        ],
        posibleIncapacidad: true, ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje', 'ejercicioIntenso'],
      };
    }
    if (g >= IMPACTO.golpe) {
      return {
        nivel: 'aviso', titulo: 'Golpe en la cabeza', detalleTecnico: detalle, datos, region: 'craneo',
        resumenSimple: 'Recibiste un golpe en la cabeza.',
        accion: `Higia te hará unas preguntas de orientación. ${vigilar}`,
        accionPorUbicacion: { eva: `Pausa la tarea y asegúrate al arnés. Higia te hará unas preguntas de orientación. ${vigilar}` },
        ruta: 'reporte', sensible: false, bloquea: ['eva', 'pilotaje'],
      };
    }
    if (g >= IMPACTO.leve && c.ubicacion !== 'rover') {
      return {
        nivel: 'info', titulo: 'Golpe leve en la cabeza', detalleTecnico: detalle, datos, region: 'craneo',
        resumenSimple: 'Hubo un golpe leve en la cabeza.', accion: vigilar, ruta: 'autogestion', sensible: false,
      };
    }
    return { ...normal('Impactos en la cabeza', detalle), datos };
  },
);

// ── Desorientación y deterioro cognitivo ──────────────────────────────

export const reglaOrientacion = definirRegla(
  {
    id: 'mental.orientacion', nombre: 'Orientación y rendimiento cognitivo', sistema: 'cerebro',
    sensores: ['orientacion', 'cognicion', 'tiempoReaccion'],
    fuente: 'Anexo B: rendimiento cognitivo y conductual · Pruebas tipo Cognition / WinSCAT y PVT',
    hrp: ['conductual', 'sensoriomotor'],
  },
  (h, p, ahora) => {
    const orientacion = ultimaReciente(h, 'orientacion', ahora, 12);
    const cognicion = ultimaReciente(h, 'cognicion', ahora, 24);
    const reaccion = ultimaReciente(h, 'tiempoReaccion', ahora, 24);
    if (!orientacion && !cognicion && !reaccion) return null;
    const datos = datosDe(p, orientacion, cognicion, reaccion);

    const baseCog = p.lineaBase.cognicion ?? 85;
    const baseRt = p.lineaBase.tiempoReaccion ?? 270;
    const caidaCog = cognicion ? (baseCog - cognicion.valor) / baseCog : 0;
    const subeRt = reaccion ? (reaccion.valor - baseRt) / baseRt : 0;
    const partes = [
      orientacion && `orientación ${orientacion.valor}/10`,
      cognicion && `prueba cognitiva ${cognicion.valor}/100 (línea base ${baseCog}, ${caidaCog >= 0 ? '−' : '+'}${Math.abs(Math.round(caidaCog * 100))} %)`,
      reaccion && `tiempo de reacción ${reaccion.valor} ms (línea base ${baseRt}, ${subeRt >= 0 ? '+' : '−'}${Math.abs(Math.round(subeRt * 100))} %)`,
    ].filter(Boolean);
    const detalle = partes.join(' · ');
    const pasosDesorientacion = [
      'Detén cualquier tarea de riesgo (EVA, maquinaria, conducción del rover).',
      'Siéntate en un lugar seguro y bien iluminado.',
      'Un compañero debe quedarse contigo y hablarte con calma: dónde están, qué día es, qué están haciendo.',
      'Revisen juntos si hubo un golpe, poco oxígeno, mucho cansancio o medicación nueva.',
      'Higia repetirá el chequeo de orientación en unos minutos.',
    ];

    if ((orientacion && orientacion.valor <= 4) || caidaCog >= 0.3 || subeRt >= 0.5) {
      const porOrientacion = !!orientacion && orientacion.valor <= 4;
      return {
        nivel: 'alerta', titulo: porOrientacion ? 'Desorientación marcada' : 'Deterioro cognitivo marcado', detalleTecnico: detalle, datos, region: 'craneo',
        resumenSimple: porOrientacion ? 'Parece que te cuesta ubicarte en dónde estás o qué día es.' : 'Tu atención y tu memoria rinden bastante menos que de costumbre.',
        textoCalmado: 'Vamos a tomarlo con calma. Quédate donde estás; alguien vendrá a acompañarte.',
        accion: 'Detén lo que haces y quédate en un lugar seguro. Higia avisa a un compañero.',
        accionPorUbicacion: { eva: 'Detén la EVA y asegúrate al arnés. Tu compañero debe guiarte de regreso.' },
        pasos: pasosDesorientacion,
        posibleIncapacidad: true, ruta: 'reporte', sensible: true, bloquea: ['eva', 'pilotaje'],
      };
    }
    if ((orientacion && orientacion.valor <= 7) || caidaCog >= 0.15 || subeRt >= 0.25) {
      const porOrientacion = !!orientacion && orientacion.valor <= 7;
      return {
        nivel: 'aviso', titulo: porOrientacion ? 'Desorientación leve' : 'Rendimiento cognitivo más bajo', detalleTecnico: detalle, datos, region: 'craneo',
        resumenSimple: porOrientacion ? 'Algunas respuestas de orientación no fueron correctas.' : 'Tu atención está algo más lenta que de costumbre.',
        textoCalmado: 'Parece que hoy estás algo cansado. Vamos a ir con calma.',
        accion: 'Evita tareas de riesgo por ahora, descansa e hidrátate. Higia repetirá la prueba más tarde.',
        ruta: 'reporte', sensible: true, bloquea: ['eva', 'pilotaje'],
      };
    }
    return { ...normal('Orientación y rendimiento cognitivo', detalle, true), datos };
  },
);

// ── Posibles síntomas psicóticos ───────────────────────────────────────

export const reglaPsicosis = definirRegla(
  {
    id: 'mental.psicosis', nombre: 'Alteraciones de la percepción', sistema: 'cerebro',
    sensores: ['marcadoresPsicoticos', 'horasSueno', 'estres'],
    fuente: 'Anexo B: salud conductual en aislamiento y confinamiento · Factores de riesgo: privación de sueño y estrés',
    hrp: ['conductual'],
  },
  (h, p, ahora) => {
    const marcadores = ultimaReciente(h, 'marcadoresPsicoticos', ahora, 24);
    if (!marcadores) return null;
    const noches = h.ultimas('horasSueno', 3);
    const estres = ultimaReciente(h, 'estres', ahora, 12);
    const datos = [...datosDe(p, marcadores, estres), ...noches.map((n) => dato(n, p))];
    const sueno = noches.length ? r1(promedio(noches.map((n) => n.valor))) : undefined;
    const suenoBajo = sueno !== undefined && sueno < 5;
    const estresAlto = !!estres && estres.valor >= 70;
    const factores = [suenoBajo && `sueño promedio ${sueno} h`, estresAlto && `estrés ${estres!.valor}/100`].filter(Boolean);
    const detalle = `Señales en la conversación ${marcadores.valor}/10${factores.length ? ` · factores de riesgo: ${factores.join(', ')}` : ''}`;
    const pasos = [
      'No te quedes solo: un compañero debe acompañarte con calma, sin discutir lo que percibes.',
      'Suspende EVA, maquinaria y tareas críticas por ahora.',
      'Busca un lugar tranquilo, con poca estimulación, y descansa.',
      'Higia avisa al médico de la misión (a bordo, en la base o en Tierra).',
      'Duerme lo que puedas: la falta de sueño empeora estas percepciones.',
    ];

    if (marcadores.valor >= 6 || (marcadores.valor >= 4 && suenoBajo && estresAlto)) {
      return {
        nivel: 'alerta', titulo: 'Posibles síntomas psicóticos', detalleTecnico: detalle, datos, region: 'craneo',
        resumenSimple: 'Lo que cuentas sugiere que tu percepción puede estar alterada.',
        textoCalmado: 'Higia está contigo. Vamos a buscar a alguien para que te acompañe y conversar con calma.',
        accion: 'No te quedes solo. Higia avisa a un compañero y al médico de la misión.',
        pasos, ruta: 'reporte', sensible: true, bloquea: ['eva', 'pilotaje'],
      };
    }
    if (marcadores.valor >= 3 || (marcadores.valor >= 1 && (suenoBajo || estresAlto))) {
      return {
        nivel: 'aviso', titulo: 'Señales de alteración de la percepción', detalleTecnico: detalle, datos, region: 'craneo',
        resumenSimple: 'Algunas cosas que cuentas pueden deberse al cansancio o al estrés.',
        textoCalmado: 'Puede que estés muy cansado. Un buen descanso y una charla pueden ayudar.',
        accion: 'Descansa, habla con alguien de confianza y avísale a Higia si notas algo extraño de nuevo.',
        ruta: 'reporte', sensible: true,
      };
    }
    return { ...normal('Percepción', detalle, true), datos };
  },
);
