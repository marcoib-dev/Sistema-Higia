// AVISO: UMBRALES PROVISIONALES: validar con oftalmología y con §7.1.10 antes de la demo.
// El criterio de grosor de retina (OCT) está pendiente de verificar contra la fuente oficial antes de citarlo.
import { ORDEN_NIVEL, type Nivel } from '../tipos';
import { caidaRelativa, datosDe, definirRegla, normal, pct, subirNivel, tieneAntecedente, ultimaReciente } from './util';

export const SANS = { retinaAviso: 20, retinaAlerta: 50, pioAviso: 21, pioAlerta: 30, visionAviso: 0.1, visionAlerta: 0.25 };

const max = (...ns: Nivel[]): Nivel => ns.reduce((a, b) => (ORDEN_NIVEL[b] > ORDEN_NIVEL[a] ? b : a), 'normal');

export const reglaSANS = definirRegla(
  {
    id: 'sans.vision', nombre: 'Visión y fondo de ojo (SANS)', sistema: 'ojos',
    sensores: ['agudezaVisual', 'presionIntraocular', 'grosorRetina', 'sxVision', 'sxCefalea'],
    fuente: '§7.1.10 SANS (~70 % con hinchazón ocular) · B-Complex: OCT · Brain Fluid Pressure: presión ocular · ISAFE: pruebas de visión',
    hrp: ['sans'],
  },
  (h, p, ahora) => {
    const mes = 30 * 24;
    const agudeza = ultimaReciente(h, 'agudezaVisual', ahora, mes);
    const pio = ultimaReciente(h, 'presionIntraocular', ahora, mes);
    const retina = ultimaReciente(h, 'grosorRetina', ahora, mes);
    const sx = ultimaReciente(h, 'sxVision', ahora, 72);
    const cefalea = ultimaReciente(h, 'sxCefalea', ahora, 72);
    if (!agudeza && !pio && !retina && !sx) return null;

    const baseVision = p.lineaBase.agudezaVisual ?? 95;
    const caida = agudeza ? caidaRelativa(agudeza.valor, baseVision) : 0;
    const nRetina: Nivel = !retina ? 'normal' : retina.valor >= SANS.retinaAlerta ? 'alerta' : retina.valor >= SANS.retinaAviso ? 'aviso' : 'normal';
    const nPio: Nivel = !pio ? 'normal' : pio.valor > SANS.pioAlerta ? 'alerta' : pio.valor > SANS.pioAviso ? 'aviso' : 'normal';
    const nVision: Nivel = !agudeza ? 'normal' : caida >= SANS.visionAlerta ? 'alerta' : caida >= SANS.visionAviso ? 'aviso' : 'normal';
    const pruebas = max(nRetina, nPio, nVision);
    const conSintoma = (sx?.valor ?? 0) >= 3;
    const hayPruebas = !!(agudeza || pio || retina);
    let nivel: Nivel = pruebas;
    if (conSintoma && pruebas !== 'normal') nivel = subirNivel(pruebas);
    else if (conSintoma && !hayPruebas) nivel = 'info';

    const antecedente = tieneAntecedente(p, 'ojos');
    const partes = [
      agudeza && `prueba de visión ${agudeza.valor}/100 (línea base ${baseVision}${caida > 0 ? `, −${pct(caida)}` : ''})`,
      pio && `presión intraocular ${pio.valor} mmHg`,
      retina && `retina ${retina.valor >= 0 ? '+' : ''}${retina.valor} µm en la OCT respecto de antes del vuelo`,
      sx && sx.valor > 0 && `cambios de visión ${sx.valor}/10`,
      cefalea && cefalea.valor >= 3 && pruebas !== 'normal' && `dolor de cabeza ${cefalea.valor}/10`,
      antecedente && `antecedente: ${p.historiaClinica.antecedentes.filter((a) => a.sistema === 'ojos').map((a) => a.nombre).join(', ')}`,
    ].filter(Boolean);
    const datos = datosDe(p, agudeza, pio, retina, sx, cefalea);
    const detalle = partes.join(' · ');
    if (nivel === 'normal') return { ...normal('Visión', detalle), datos, region: undefined };

    if (nivel === 'info') {
      return {
        nivel, titulo: 'Cambios de visión para revisar', detalleTecnico: detalle, datos, region: 'cara',
        resumenSimple: 'Notas cambios en la visión. Es frecuente en el espacio y conviene medirlo.',
        accion: 'Haz la prueba de visión cuando puedas: Higia la compara con tu valor de antes del vuelo.',
        ruta: 'autogestion', sensible: false,
      };
    }
    const base = {
      detalleTecnico: detalle, datos, region: 'cara' as const, ruta: 'reporte' as const, sensible: false,
      accion: 'Haz la prueba de visión y la OCT de seguimiento, usa los brazaletes de muslo según el protocolo y envía el reporte a Tierra.',
    };
    if (nivel === 'aviso') {
      return {
        ...base, nivel, titulo: 'Señales de síndrome neuro-ocular (SANS)',
        resumenSimple: 'Hay cambios en tu ojo por el desplazamiento de fluidos hacia la cabeza. Le pasa a cerca del 70 % de los astronautas.',
      };
    }
    return {
      ...base, nivel, titulo: 'Cambios oculares marcados (SANS)',
      resumenSimple: 'Los cambios en tu ojo son importantes y hay que seguirlos de cerca.',
      pasos: [
        'Evita tareas que dependan de visión fina (pilotaje, soldadura, lectura de instrumentos pequeños) hasta revisar.',
        'Repite la prueba de visión y la OCT para confirmar el cambio.',
        'Usa los brazaletes de muslo en la sesión indicada por el protocolo.',
        'Anota si hay dolor de cabeza, visión doble o manchas.',
        'Higia envía el reporte a Tierra con las imágenes y tus valores previos.',
      ],
      bloquea: ['pilotaje'],
    };
  },
);
