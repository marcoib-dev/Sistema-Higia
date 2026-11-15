/**
 * PRESENCIA DE HIGIA — deja claro, de un vistazo y desde cualquier parte de la app, qué está
 * haciendo el asistente:
 *  - escuchando (dijeron «Higia» o se tocó el micrófono): borde de la pantalla en violeta y cian,
 *    con lo que se va oyendo en vivo;
 *  - pensando: borde azul que respira;
 *  - hablando: borde turquesa (se calla con Esc o desde la barra superior).
 * Un tono corto acompaña el «te escucho» (ver `sonarLlamado`).
 */
import { TEXTO_ACTIVIDAD, type ActividadHigia, type Asistente } from '../asistente';
import { Icono } from '../iconos';

/** Orbe animado: el "rostro" de Higia. Cambia de color y movimiento según lo que hace. */
export function OrbeHigia({ actividad, tamano = 56 }: { actividad: ActividadHigia; tamano?: number }) {
  return (
    <span className={`orbe orbe-${actividad}`} style={{ width: tamano, height: tamano }} aria-hidden>
      <span className="orbe-onda" />
      <span className="orbe-onda orbe-onda-2" />
      <span className="orbe-nucleo">
        {actividad === 'hablando'
          ? <span className="orbe-barras"><i /><i /><i /><i /></span>
          : <Icono nombre={actividad === 'pensando' ? 'ia' : 'microfono'} tamano={Math.round(tamano * 0.38)} />}
      </span>
    </span>
  );
}

const VISIBLE: ActividadHigia[] = ['escuchando', 'pensando', 'hablando'];

export function AuraHigia({ asistente: a }: { asistente: Asistente }) {
  const visible = VISIBLE.includes(a.actividad);
  // Mientras habla basta el borde: la pastilla taparía lo que está explicando (p. ej. los pasos de una prueba).
  const conPastilla = visible && a.actividad !== 'hablando';
  return (
    <>
      <div className={`aura aura-${a.actividad} ${visible ? 'visible' : ''}`} aria-hidden />
      <div className={`pastilla-higia pastilla-${a.actividad} ${conPastilla ? 'visible' : ''}`} role="status" aria-live="polite">
        {conPastilla && (
          <>
            <OrbeHigia actividad={a.actividad} tamano={34} />
            <span className="pastilla-texto">
              <strong>{a.actividad === 'escuchando' ? 'Higia te escucha' : TEXTO_ACTIVIDAD[a.actividad]}</strong>
              {a.actividad === 'escuchando' && (
                <span className="pastilla-parcial">{a.parcial ? `«${a.parcial}»` : 'Habla ahora…'}</span>
              )}
            </span>
          </>
        )}
      </div>
    </>
  );
}
