/**
 * ENRUTADOR DE CANALES — por dónde y cuándo se interrumpe al astronauta.
 * Implementa la tabla "Canales de salida según el contexto" del documento de visión.
 */
import type { Canal, Contexto, Hallazgo, Perfil } from './tipos';

export interface DecisionCanal {
  canal: Canal;
  voz: boolean;
  interrumpir: boolean;
  diferido: boolean;
  motivo: string;
}

export function estaDurmiendo(p: Perfil, c: Contexto): boolean {
  const { inicio, fin } = p.horarioSueno;
  return inicio <= fin ? c.hora >= inicio && c.hora < fin : c.hora >= inicio || c.hora < fin;
}

const decision = (canal: Canal, motivo: string, extra: Partial<DecisionCanal> = {}): DecisionCanal => ({
  canal, motivo, voz: canal === 'auricular', interrumpir: canal !== 'figura', diferido: false, ...extra,
});

export function elegirCanal(h: Hallazgo, c: Contexto, p: Perfil): DecisionCanal {
  // 1. Modo pasivo: lo informativo solo colorea la figura.
  if (h.nivel === 'normal') return decision('figura', 'Volvió a la normalidad: solo se actualiza la figura.');
  if (h.nivel === 'info') return decision('figura', 'Informativo: se refleja en la figura sin interrumpir.');

  // 2. Se respeta el sueño: los avisos esperan; las alertas no.
  if (h.nivel === 'aviso' && estaDurmiendo(p, c)) {
    return decision('figura', 'Horario de sueño: el aviso se entregará al despertar.', { diferido: true });
  }

  // 3. Información sensible: solo canales privados.
  if (h.sensible) {
    if (c.ubicacion === 'habitat' && c.pantallaPersonal) {
      return decision('pantallaPersonal', 'Información sensible: canal privado, nunca la pantalla compartida.');
    }
    if (c.auricular) return decision('auricular', 'Información sensible: por auricular privado.');
    return decision('figura', 'Información sensible sin canal privado disponible: se retiene.', { diferido: true });
  }

  // 4. Fuera del hábitat: voz breve, sin pantallas.
  if (c.ubicacion !== 'habitat' && c.auricular) {
    return decision('auricular', 'Fuera del hábitat: indicación breve por voz.');
  }

  // 5. Dentro del hábitat: se aprovecha la pantalla si existe.
  if (c.pantallaHabitat) {
    return decision('pantallaHabitat', 'Dentro del hábitat: se activa la pantalla.', { voz: h.nivel === 'alerta' });
  }
  if (c.pantallaPersonal) return decision('pantallaPersonal', 'Sin pantalla del hábitat: pantalla personal.');
  if (c.auricular) return decision('auricular', 'Sin pantalla disponible: por voz.');

  return decision('figura', 'Ningún canal activo: queda pendiente.', { diferido: true });
}
