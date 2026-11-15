/**
 * PANEL DEL SIMULADOR — lo que en la realidad harían los sensores, el hábitat y la tripulación.
 * Separado de la interfaz del astronauta. Tecla D para abrir y cerrar; dos tamaños (compacto y amplio).
 */
import { useEffect, useRef, useState } from 'react';
import type { Escenario } from '../../adaptadores/simulador/escenarios';
import type { RegistroSimulacion } from '../../adaptadores/simulador/registro';
import type { NucleoSalud } from '../../core/nucleo';
import type { Contexto, Lectura } from '../../core/tipos';
import { Icono } from '../iconos';
import { teclaReproductor } from './BarraReproduccion';
import { CoberturaHRP } from './CoberturaHRP';
import { PestanaContexto } from './PestanaContexto';
import { PestanaDatos } from './PestanaDatos';
import { PestanaEscenarios } from './PestanaEscenarios';
import { PestanaRegistro } from './PestanaRegistro';
import { PestanaTripulacion } from './PestanaTripulacion';
import type { Simulador } from './useSimulador';
import './simulador.css';

export type Pestana = 'escenarios' | 'datos' | 'contexto' | 'tripulacion' | 'cobertura' | 'registro';

const PESTANAS: [Pestana, string][] = [
  ['escenarios', 'Escenarios'], ['datos', 'Datos'], ['contexto', 'Contexto'],
  ['tripulacion', 'Tripulación'], ['cobertura', 'Cobertura'], ['registro', 'Registro'],
];

const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

interface Props {
  abierto: boolean;
  amplio: boolean;
  onAmplio: (v: boolean) => void;
  onCerrar: () => void;
  sim: Simulador;
  nucleo: NucleoSalud;
  registro: RegistroSimulacion;
  iaConfigurada: boolean;
  evaDesde: number | null;
  ahora: number;
  onPerfil: (id: string) => void;
  onContexto: (c: Partial<Contexto>) => void;
  onInyectar: (ls: Lectura[]) => void;
  onDiaNormal: () => void;
  onIniciarEva: (minutos: number) => void;
  onTerminarEva: () => void;
  onPantallaCompleta: () => void;
}

export function PanelSimulador(p: Props) {
  const [pestana, setPestanaEstado] = useState<Pestana>(() => (leer('higia.simulador.pestana') as Pestana) || 'escenarios');
  const panel = useRef<HTMLElement>(null);
  const setPestana = (x: Pestana) => { setPestanaEstado(x); guardar('higia.simulador.pestana', x); };

  // Cerrado = fuera del orden de tabulación y de los lectores de pantalla (inert).
  useEffect(() => {
    panel.current?.toggleAttribute('inert', !p.abierto);
    if (p.abierto) panel.current?.focus();
  }, [p.abierto]);

  const n = p.nucleo;
  const reproducir = (e: Escenario) => p.sim.ejecutarEscenario(e);
  const enEscenario = p.sim.reproductor.escenario?.hrp ?? [];

  // Pestañas con el patrón tablist: flechas izquierda y derecha.
  const teclaPestanas = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = PESTANAS.findIndex(([id]) => id === pestana);
    const j = (i + (e.key === 'ArrowRight' ? 1 : PESTANAS.length - 1)) % PESTANAS.length;
    setPestana(PESTANAS[j][0]);
    document.getElementById(`tab-sim-${PESTANAS[j][0]}`)?.focus();
    e.preventDefault();
  };

  return (
    <aside
      id="panel-simulador" ref={panel} tabIndex={-1} className={`panel-sim ${p.abierto ? 'abierto' : ''} ${p.amplio ? 'amplio' : ''}`}
      aria-label="Simulador"
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); p.onCerrar(); return; }
        if (teclaReproductor(e, p.sim)) e.preventDefault();
      }}
    >
      <div className="panel-sim-cab">
        <div>
          <h2>Simulador</h2>
          <p>Hace lo que harían los sensores, el hábitat y la tripulación.</p>
        </div>
        <button className="boton-icono" onClick={() => p.onAmplio(!p.amplio)} aria-pressed={p.amplio} aria-label={p.amplio ? 'Panel compacto' : 'Panel amplio'} title={p.amplio ? 'Panel compacto' : 'Panel amplio'}>
          <Icono nombre={p.amplio ? 'contraer' : 'expandir'} />
        </button>
        <button className="boton-icono" onClick={p.onCerrar} aria-label="Cerrar simulador (Esc)"><Icono nombre="cerrar" /></button>
      </div>

      <div className="pestanas pestanas-sim" role="tablist" aria-label="Secciones del simulador" onKeyDown={teclaPestanas}>
        {PESTANAS.map(([id, nombre]) => (
          <button key={id} role="tab" id={`tab-sim-${id}`} aria-selected={pestana === id} aria-controls={`sim-${id}`} tabIndex={pestana === id ? 0 : -1} onClick={() => setPestana(id)}>
            {nombre}
          </button>
        ))}
      </div>

      <div className="panel-sim-cuerpo" role="tabpanel" id={`sim-${pestana}`} aria-labelledby={`tab-sim-${pestana}`}>
        {pestana === 'escenarios' && <PestanaEscenarios sim={p.sim} />}
        {pestana === 'datos' && (
          <PestanaDatos perfil={n.perfil} historial={n.historial} hallazgos={n.hallazgosActuales()} onInyectar={p.onInyectar}
            onDiaNormal={p.onDiaNormal} onLimpiar={() => p.sim.reiniciarSimulacion()} />
        )}
        {pestana === 'contexto' && (
          <PestanaContexto contexto={n.contexto} aptitud={n.aptitudTareas()} evaDesde={p.evaDesde} ahora={p.ahora}
            onContexto={p.onContexto} onIniciarEva={p.onIniciarEva} onTerminarEva={p.onTerminarEva} />
        )}
        {pestana === 'tripulacion' && <PestanaTripulacion perfil={n.perfil} sim={p.sim} iaConfigurada={p.iaConfigurada} onPerfil={p.onPerfil} />}
        {pestana === 'cobertura' && (
          <CoberturaHRP estado={n.estadoRiesgosHRP()} enEscenario={enEscenario} onReproducir={reproducir} onPantallaCompleta={p.onPantallaCompleta} />
        )}
        {pestana === 'registro' && <PestanaRegistro registro={p.registro} />}
      </div>
    </aside>
  );
}
