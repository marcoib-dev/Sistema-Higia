// AVISO: UMBRALES PROVISIONALES: validar contra los estándares de habitabilidad antes de la demo.
// Entorno cerrado u hostil (Anexo A, peligro 5): ruido de la cabina, sobre todo en horario de sueño.
import { estaDurmiendo } from '../canales';
import type { Nivel } from '../tipos';
import { definirRegla, normal, ultimaReciente } from './util';

export const RUIDO = { suenoInfo: 50, suenoAviso: 60, vigiliaAviso: 70, vigiliaAlerta: 85 };

export const reglaRuido = definirRegla(
  {
    id: 'entorno.ruido', nombre: 'Ruido de la cabina', sistema: 'oidoInterno',
    sensores: ['ruidoCabina'],
    fuente: 'Anexo A: entornos cerrados (ruido) · §7.2.3 Sueño inadecuado',
    hrp: ['sueno'],
  },
  (h, p, ahora, c) => {
    const ult = ultimaReciente(h, 'ruidoCabina', ahora, 2);
    if (!ult) return null;
    const db = ult.valor;
    const durmiendo = estaDurmiendo(p, c);
    const detalle = `Ruido de ${db} dBA${durmiendo ? ' en horario de sueño' : ''}`;
    const nivel: Nivel = durmiendo
      ? db > RUIDO.suenoAviso ? 'aviso' : db > RUIDO.suenoInfo ? 'info' : 'normal'
      : db > RUIDO.vigiliaAlerta ? 'alerta' : db > RUIDO.vigiliaAviso ? 'aviso' : 'normal';
    if (nivel === 'normal') return normal('Ruido', detalle);
    if (nivel === 'alerta') {
      return {
        nivel, titulo: 'Ruido peligroso para el oído', detalleTecnico: detalle,
        resumenSimple: 'Hay mucho ruido: puede dañar tu oído.',
        accion: 'Ponte protectores auditivos y aléjate de la fuente del ruido.',
        pasos: [
          'Ponte protectores auditivos o auriculares con cancelación.',
          'Aléjate del equipo que hace ruido o cierra la escotilla del módulo.',
          'Revisa si un ventilador, bomba o filtro está fallando.',
          'Avisa a la tripulación para que se protejan también.',
        ],
        ruta: 'reporte', sensible: false,
      };
    }
    return {
      nivel, titulo: durmiendo ? 'Ruido que dificulta el sueño' : 'Ruido alto en la cabina', detalleTecnico: detalle,
      resumenSimple: durmiendo ? 'El ruido de la cabina puede no dejarte descansar bien.' : 'El ruido de la cabina es alto.',
      accion: durmiendo
        ? 'Usa tapones para dormir y, al despertar, revisa qué equipo está haciendo ruido.'
        : 'Usa protección auditiva si vas a quedarte en este módulo y revisa la fuente del ruido.',
      ruta: 'autogestion', sensible: false,
    };
  },
);
