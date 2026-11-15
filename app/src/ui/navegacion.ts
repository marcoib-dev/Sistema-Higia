/**
 * Navegación por secciones con el hash de la URL (#/mensajes): funciona el botón "atrás"
 * y se puede compartir un enlace directo a una sección.
 * El asistente es la base de la app: es la sección de inicio y desde él se controla todo lo demás.
 */
import { useEffect, useState } from 'react';
import type { SeccionApp } from '../core/acciones';
import type { NombreIcono } from './iconos';

export type Seccion = SeccionApp;

export const SECCIONES: { id: Seccion; nombre: string; icono: NombreIcono; descripcion: string }[] = [
  { id: 'asistente', nombre: 'Higia', icono: 'asistente', descripcion: 'El asistente: habla con Higia y controla la app' },
  { id: 'resumen', nombre: 'Resumen', icono: 'resumen', descripcion: 'Estado del cuerpo y lo que requiere atención' },
  { id: 'pruebas', nombre: 'Pruebas', icono: 'pruebas', descripcion: 'Pruebas a bordo: cognitiva, reacción, fuerza isométrica y Valsalva' },
  { id: 'mensajes', nombre: 'Mensajes', icono: 'mensajes', descripcion: 'Avisos y alertas enviados al astronauta' },
  { id: 'comunicaciones', nombre: 'Comunicaciones', icono: 'escalado', descripcion: 'Lo que Higia envió a otros y sus respuestas' },
  { id: 'perfil', nombre: 'Perfil', icono: 'documento', descripcion: 'Perfil e historia clínica previa' },
  { id: 'entorno', nombre: 'Entorno', icono: 'entorno', descripcion: 'Contexto actual y cámara' },
  { id: 'reportes', nombre: 'Reportes', icono: 'reportes', descripcion: 'Escaladas y envíos a sistemas médicos' },
];

const INICIO: Seccion = 'asistente';

const leer = (): Seccion => {
  const h = window.location.hash.replace('#/', '');
  return SECCIONES.some((s) => s.id === h) ? (h as Seccion) : INICIO;
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
