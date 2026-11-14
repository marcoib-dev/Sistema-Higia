import { PERFILES } from '../adaptadores/simulador/perfiles';
import { redactar } from '../core/personalizador';
import type { Contexto, Mensaje } from '../core/tipos';

/** El momento clave de la demo: el mismo hallazgo, contado a tres personas distintas. */
export function PanelComparacion({ mensaje, contexto }: { mensaje?: Mensaje; contexto: Contexto }) {
  return (
    <section className="tarjeta">
      <h2>Mismo evento, tres perfiles</h2>
      {!mensaje ? (
        <p className="vacio">Aparece cuando hay un aviso o una alerta.</p>
      ) : (
        <>
          <p className="sub">{mensaje.hallazgo.titulo}</p>
          <ul className="comparacion">
            {PERFILES.map((p) => (
              <li key={p.id}>
                <strong>{p.nombre}</strong> <span className="sub">({p.rol})</span>
                <p>{redactar(mensaje.hallazgo, p, contexto, { breve: mensaje.canal === 'auricular' })}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
