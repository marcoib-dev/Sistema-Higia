/** Piezas básicas reutilizables de la interfaz. */
import type { ReactNode } from 'react';
import type { Canal, Nivel } from '../../core/tipos';
import { Icono, type NombreIcono } from '../iconos';

export type EstadoVisual = Nivel | 'sinDatos';

export const NOMBRE_NIVEL: Record<EstadoVisual, string> = {
  normal: 'Normal', info: 'Info', aviso: 'Aviso', alerta: 'Alerta', sinDatos: 'Sin datos',
};

export const CANAL: Record<Canal, { nombre: string; icono: NombreIcono }> = {
  pantallaHabitat: { nombre: 'Pantalla del hábitat', icono: 'pantalla' },
  pantallaPersonal: { nombre: 'Pantalla personal', icono: 'movil' },
  auricular: { nombre: 'Auricular', icono: 'auricular' },
  figura: { nombre: 'Solo en la figura', icono: 'ojo' },
};

/** Quita el título del inicio de un texto redactado, cuando ya se muestra el título aparte. */
export function sinTitulo(texto: string, titulo: string): string {
  return texto.startsWith(titulo) ? texto.slice(titulo.length).replace(/^[.:]\s*/, '') : texto;
}

/** Insignia de nivel: color + texto (nunca solo color). */
export function InsigniaNivel({ nivel }: { nivel: EstadoVisual }) {
  return <span className={`insignia nivel-${nivel}`}>{NOMBRE_NIVEL[nivel]}</span>;
}

export function Etiqueta({ icono, children, tono }: { icono?: NombreIcono; children: ReactNode; tono?: 'alerta' | 'ia' }) {
  return (
    <span className={`etiqueta ${tono ? `etiqueta-${tono}` : ''}`}>
      {icono && <Icono nombre={icono} tamano={14} />}
      {children}
    </span>
  );
}

export function Punto({ nivel }: { nivel: EstadoVisual }) {
  return <span className={`punto nivel-${nivel}`} aria-hidden />;
}

/** Interruptor accesible (role="switch"). */
export function Interruptor({ etiqueta, descripcion, activo, onCambio }: {
  etiqueta: string; descripcion?: string; activo: boolean; onCambio: (v: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={activo} className="interruptor" onClick={() => onCambio(!activo)}>
      <span className="interruptor-texto">
        <span>{etiqueta}</span>
        {descripcion && <small>{descripcion}</small>}
      </span>
      <span className="interruptor-pista" aria-hidden><span className="interruptor-perilla" /></span>
    </button>
  );
}

/** Control segmentado (una opción entre pocas). */
export function Segmentado<T extends string>({ etiqueta, opciones, valor, onCambio }: {
  etiqueta: string; opciones: { id: T; nombre: string }[]; valor: T; onCambio: (v: T) => void;
}) {
  return (
    <div className="campo">
      <span className="campo-etiqueta">{etiqueta}</span>
      <div className="segmentado" role="radiogroup" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} onClick={() => onCambio(o.id)}>{o.nombre}</button>
        ))}
      </div>
    </div>
  );
}

export function EncabezadoSeccion({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="encabezado-seccion">
      <div>
        <h1>{titulo}</h1>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {acciones && <div className="encabezado-acciones">{acciones}</div>}
    </div>
  );
}

export function Vacio({ icono, titulo, children }: { icono: NombreIcono; titulo: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      <Icono nombre={icono} tamano={28} />
      <p className="vacio-titulo">{titulo}</p>
      {children && <div className="vacio-texto">{children}</div>}
    </div>
  );
}
