/**
 * SIMULADOR EN LA APP — reproduce escenarios sobre el núcleo real, con línea de tiempo, registro
 * y conducta de la tripulación. Saca de App.tsx todo lo que es propio de la demo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { perfilDe } from '../../adaptadores/simulador/ejecutor';
import { CONTEXTO_BASE, ESCENARIOS, GUION_DEMO, type Escenario, type PasoEscenario } from '../../adaptadores/simulador/escenarios';
import { PERFILES } from '../../adaptadores/simulador/perfiles';
import type { RegistroSimulacion } from '../../adaptadores/simulador/registro';
import { Reproductor, type Velocidad } from '../../adaptadores/simulador/reproductor';
import { CONDUCTA_NORMAL, type ConductaTripulacion } from '../../adaptadores/simulador/tripulacion';
import { estadoVoz } from '../../adaptadores/voz/voz';
import type { OrdenSimulador } from '../../core/acciones';
import type { NucleoSalud } from '../../core/nucleo';
import { INFO_SENSOR, type Contexto, type Lectura, type Mensaje, type Perfil } from '../../core/tipos';

export interface DependenciasSimulador {
  nucleo: NucleoSalud;
  registro: RegistroSimulacion;
  /** Crea un núcleo nuevo con ese perfil y contexto, lo instala y limpia el estado de la app. Lo devuelve. */
  reiniciarNucleo: (perfil: Perfil, contexto: Contexto) => NucleoSalud;
  procesar: (ms: Mensaje[]) => void;
  cambiarContexto: (c: Partial<Contexto>) => void;
  /** La frase del paso entra por el asistente, como si la hubiera dicho el astronauta. */
  decirFrase: (frase: string) => void;
}

export interface Simulador {
  reproductor: Reproductor;
  /** Hay un escenario cargado (reproduciendo, en pausa o terminado). */
  activo: boolean;
  conducta: ConductaTripulacion;
  conductaRef: React.MutableRefObject<ConductaTripulacion>;
  cambiarConducta: (c: Partial<ConductaTripulacion>) => void;
  iaEnSimulador: boolean;
  setIaEnSimulador: (v: boolean) => void;
  reproducidos: Set<string>;
  ejecutarEscenario: (e: Escenario, opciones?: { pausado?: boolean }) => void;
  reproducirGuion: () => void;
  control: (orden: OrdenSimulador) => void;
  cambiarVelocidad: (v: Velocidad) => void;
  /** Limpia todo: núcleo nuevo, sin escenario. */
  reiniciarSimulacion: (perfilId?: string, contexto?: Partial<Contexto>) => void;
  /** Higia escaló una alerta: el paso que lo esperaba se da por cumplido. */
  notificarEscalada: () => void;
}

/** Resumen corto de lo que inyectó un paso, para el registro. */
const resumenLecturas = (ls: Lectura[]) => {
  const partes = ls.slice(0, 6).map((l) => `${INFO_SENSOR[l.sensor].nombre} ${Math.round(l.valor * 10) / 10} ${INFO_SENSOR[l.sensor].unidad}`);
  return `${partes.join(', ')}${ls.length > 6 ? ` y ${ls.length - 6} datos más` : ''}`;
};

export function useSimulador(deps: DependenciasSimulador): Simulador {
  const [, setVersion] = useState(0);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  // El núcleo vigente, también entre el reinicio y el próximo render.
  const nucleoRef = useRef(deps.nucleo);
  useEffect(() => { nucleoRef.current = deps.nucleo; }, [deps.nucleo]);

  const [conducta, setConducta] = useState<ConductaTripulacion>(CONDUCTA_NORMAL);
  const conductaRef = useRef(conducta);
  conductaRef.current = conducta;
  const [iaEnSimulador, setIaEnSimulador] = useState(false);
  const [reproducidos] = useState(() => new Set<string>());

  const cambiarConducta = useCallback((c: Partial<ConductaTripulacion>) => {
    setConducta((prev) => {
      const nueva = { ...prev, ...c };
      conductaRef.current = nueva;
      return nueva;
    });
  }, []);

  const preparar = useCallback((e: Escenario) => {
    const d = depsRef.current;
    reproducidos.add(e.id);
    d.registro.agregar({ tipo: 'paso', texto: `Escenario: ${e.nombre}` });
    cambiarConducta(CONDUCTA_NORMAL);
    const actual = nucleoRef.current;
    if (e.reiniciar !== false) {
      const n = d.reiniciarNucleo(perfilDe(e, actual.perfil), { ...CONTEXTO_BASE, ...e.contextoInicial });
      nucleoRef.current = n;
      if (e.precarga) {
        const ls = e.precarga(Date.now(), n.perfil);
        n.precargar(ls);
        d.registro.agregar({ tipo: 'lecturas', texto: `Precarga silenciosa: ${ls.length} lecturas de historia` });
      }
    } else {
      if (e.contextoInicial) d.cambiarContexto(e.contextoInicial);
      if (e.precarga) actual.precargar(e.precarga(Date.now(), actual.perfil));
    }
  }, [cambiarConducta, reproducidos]);

  const aplicar = useCallback((p: PasoEscenario, i: number, e: Escenario) => {
    const d = depsRef.current;
    const n = nucleoRef.current;
    d.registro.agregar({ tipo: 'paso', texto: `Paso ${i + 1}/${e.pasos.length}: ${p.titulo}`, detalle: p.narracion });
    if (p.tripulacion) cambiarConducta(p.tripulacion);
    if (p.contexto) d.cambiarContexto(p.contexto);
    if (p.lecturas) {
      const ls = p.lecturas(Date.now(), n.historial, n.perfil);
      d.registro.agregar({ tipo: 'lecturas', texto: resumenLecturas(ls) });
      d.procesar(n.registrar(ls));
    }
    if (p.frase) {
      d.registro.agregar({ tipo: 'frase', texto: `«${p.frase}»` });
      d.decirFrase(p.frase);
    }
  }, [cambiarConducta]);

  const [reproductor] = useState(() => new Reproductor({
    aplicarPaso: (p, i, e) => aplicarRef.current(p, i, e),
    alIniciar: (e) => prepararRef.current(e),
    alCambiar: () => setVersion((v) => v + 1),
    // No pisar a Higia mientras habla (con tope de 8 s).
    puedeAvanzar: () => estadoVoz() !== 'hablando',
    retardoInicialMs: 400,
  }));
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;
  const prepararRef = useRef(preparar);
  prepararRef.current = preparar;

  useEffect(() => () => reproductor.detener(), [reproductor]);

  const ejecutarEscenario = useCallback((e: Escenario, opciones: { pausado?: boolean } = {}) => {
    reproductor.iniciar(e, { pausado: opciones.pausado, cola: [] });
  }, [reproductor]);

  const reproducirGuion = useCallback(() => {
    reproductor.iniciarGuion(GUION_DEMO.map((id) => ESCENARIOS.find((e) => e.id === id)).filter((e): e is Escenario => !!e));
  }, [reproductor]);

  const control = useCallback((orden: OrdenSimulador) => {
    switch (orden) {
      case 'pausar': reproductor.pausar(); break;
      case 'continuar': if (reproductor.estado === 'terminado') reproductor.siguiente(); else reproductor.reanudar(); break;
      case 'siguiente': reproductor.siguiente(); break;
      case 'reiniciar': reproductor.reiniciar(); break;
      case 'detener': reproductor.detener(); break;
    }
  }, [reproductor]);

  const reiniciarSimulacion = useCallback((perfilId?: string, contexto: Partial<Contexto> = {}) => {
    reproductor.detener();
    const d = depsRef.current;
    const perfil = PERFILES.find((p) => p.id === perfilId) ?? nucleoRef.current.perfil;
    nucleoRef.current = d.reiniciarNucleo(perfil, { ...CONTEXTO_BASE, ...contexto });
    d.registro.limpiar();
    cambiarConducta(CONDUCTA_NORMAL);
  }, [reproductor, cambiarConducta]);

  const notificarEscalada = useCallback(() => reproductor.liberarEspera(), [reproductor]);

  return {
    reproductor, activo: reproductor.estado !== 'inactivo', conducta, conductaRef, cambiarConducta,
    iaEnSimulador, setIaEnSimulador, reproducidos, ejecutarEscenario, reproducirGuion, control,
    cambiarVelocidad: (v) => reproductor.cambiarVelocidad(v), reiniciarSimulacion, notificarEscalada,
  };
}
