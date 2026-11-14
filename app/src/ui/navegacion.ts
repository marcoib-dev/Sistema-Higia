/**
 * Navegación por secciones con el hash de la URL (#/mensajes): funciona el botón "atrás"
 * y se puede compartir un enlace directo a una sección.
 */
import { useEffect, useState } from 'react';
import type { NombreIcono } from './iconos';

export type Seccion = 'resumen' | 'mensajes' | 'asistente' | 'entorno' | 'reportes';

export const SECCIONES: { id: Seccion; nombre: string; icono: NombreIcono; descripcion: string }[] = [
  { id: 'resumen', nombre: 'Resumen', icono: 'resumen', descripcion: 'Estado del cuerpo y lo que requiere atención' },
  { id: 'mensajes', nombre: 'Mensajes', icono: 'mensajes', descripcion: 'Avisos y alertas enviados al astronauta' },
  { id: 'asistente', nombre: 'Asistente', icono: 'asistente', descripcion: 'Conversación por voz o texto' },
  { id: 'entorno', nombre: 'Entorno', icono: 'entorno', descripcion: 'Contexto actual y cámara' },
  { id: 'reportes', nombre: 'Reportes', icono: 'reportes', descripcion: 'Escaladas y envíos a sistemas médicos' },
];

const leer = (): Seccion => {
  const h = window.location.hash.replace('#/', '');
  return SECCIONES.some((s) => s.id === h) ? (h as Seccion) : 'resumen';
};

export function useSeccion(): [Seccion, (s: Seccion) => void] {
  const [seccion, setSeccion] = useState<Seccion>(leer);
  useEffect(() => {
    const alCambiar = () => setSeccion(leer());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  const ir = (s: Seccion) => { window.location.hash = `/${s}`; };
  return [seccion, ir];
}
