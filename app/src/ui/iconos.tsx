/**
 * Set de íconos de Higia: SVG de trazo, 24×24, heredan el color del texto (currentColor).
 * Reemplazan a los emojis: se ven igual en todos los sistemas y son accesibles.
 */
import type { ReactElement } from 'react';

const P: Record<string, ReactElement> = {
  resumen: <><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7m0 0-3 6m3-6 3 6M6 11l6-2 6 2" /></>,
  mensajes: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  asistente: <path d="M4 5h16v10H9l-5 4z" />,
  entorno: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  reportes: <><path d="M12 15V4m0 0-4 4m4-4 4 4" /><path d="M4 15v5h16v-5" /></>,
  demo: <><path d="M4 7h9M19 7h1M4 17h3M13 17h7" /><circle cx="16" cy="7" r="2.5" /><circle cx="10" cy="17" r="2.5" /></>,
  reproducir: <path d="M8 5v14l11-7z" />,
  pausa: <path d="M9 5v14M15 5v14" />,
  detener: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  volumen: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 9a4 4 0 0 1 0 6" /></>,
  silencio: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="m17 9 4 6m0-6-4 6" /></>,
  microfono: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  enviar: <path d="M4 12 20 4l-6 16-3-7z" />,
  check: <path d="m5 12 5 5 9-10" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  flecha: <path d="m9 6 6 6-6 6" />,
  conexion: <><path d="M4.5 10.5a11 11 0 0 1 15 0M7.5 13.5a6.5 6.5 0 0 1 9 0" /><circle cx="12" cy="17.5" r="1.2" /></>,
  sinConexion: <><path d="M4.5 10.5a11 11 0 0 1 15 0M7.5 13.5a6.5 6.5 0 0 1 9 0" /><circle cx="12" cy="17.5" r="1.2" /><path d="M4 4l16 16" /></>,
  ia: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />,
  candado: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pantalla: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  movil: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
  auricular: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>,
  ojo: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  alerta: <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17v.5" /></>,
  escalado: <><circle cx="12" cy="12" r="1.5" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></>,
  recordatorio: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></>,
  retenido: <><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></>,
  camara: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  subir: <path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" />,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  ubicacion: <><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  usuario: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  actividad: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  personas: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  documento: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
};

export type NombreIcono = keyof typeof P;

export function Icono({ nombre, tamano = 18, titulo }: { nombre: NombreIcono; tamano?: number; titulo?: string }) {
  const relleno = nombre === 'reproducir';
  return (
    <svg
      width={tamano} height={tamano} viewBox="0 0 24 24" fill={relleno ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={titulo ? undefined : true} role={titulo ? 'img' : undefined} className="icono"
    >
      {titulo && <title>{titulo}</title>}
      {P[nombre]}
    </svg>
  );
}
