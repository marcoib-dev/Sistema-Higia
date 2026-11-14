import type { Observacion } from '../adaptadores/interop/ejemploNasa';

interface Props {
  conectado: boolean;
  pendientes: number;
  enviados: Observacion[];
}

export function PanelInterop({ conectado, pendientes, enviados }: Props) {
  const ultimo = enviados[enviados.length - 1];
  return (
    <section className="tarjeta">
      <h2>Capa de interoperabilidad <span className="etiqueta-ejemplo">EJEMPLO</span></h2>
      <p className="sub">Interfaz ilustrativa, no es una API real de la NASA. Solo se activa con conexión al hábitat.</p>
      <p>
        Estado: <strong>{conectado ? '🟢 Conectado' : '⚪ Sin conexión (modo autónomo)'}</strong><br />
        En cola: <strong>{pendientes}</strong> · Enviados: <strong>{enviados.length}</strong>
      </p>
      {ultimo && (
        <details>
          <summary>Último registro enviado (formato FHIR Observation)</summary>
          <pre>{JSON.stringify(ultimo, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
