/** Pestaña Escenarios: guion de la demo, búsqueda, filtros y tarjetas agrupadas por categoría. */
import { useMemo, useState } from 'react';
import {
  duracionMs, ESCENARIOS, GUION_DEMO, NOMBRE_CATEGORIA_ESCENARIO, type CategoriaEscenario, type Escenario,
} from '../../adaptadores/simulador/escenarios';
import { PERFILES } from '../../adaptadores/simulador/perfiles';
import { NOMBRE_PELIGRO, PELIGROS, type Peligro } from '../../core/riesgosHRP';
import type { Nivel } from '../../core/tipos';
import { InsigniaNivel } from '../componentes/basicos';
import { Icono } from '../iconos';
import { NOMBRE_CORTO_HRP } from './cobertura';
import type { Simulador } from './useSimulador';

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const CATEGORIAS = Object.keys(NOMBRE_CATEGORIA_ESCENARIO) as CategoriaEscenario[];
const NIVELES: { id: Nivel | 'todos'; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' }, { id: 'info', nombre: 'Info' }, { id: 'aviso', nombre: 'Aviso' }, { id: 'alerta', nombre: 'Alerta' },
];
const duracion = (e: Escenario) => {
  const s = Math.round(duracionMs(e) / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`;
};
const GUION = GUION_DEMO.map((id) => ESCENARIOS.find((e) => e.id === id)!).filter(Boolean);

export function PestanaEscenarios({ sim }: { sim: Simulador }) {
  const [texto, setTexto] = useState('');
  const [peligro, setPeligro] = useState<Peligro | 'todos'>('todos');
  const [categoria, setCategoria] = useState<CategoriaEscenario | 'todas'>('todas');
  const [nivel, setNivel] = useState<Nivel | 'todos'>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = normal(texto.trim());
    return ESCENARIOS.filter((e) =>
      (!q || normal(`${e.nombre} ${e.descripcion} ${e.hrp.map((h) => NOMBRE_CORTO_HRP[h]).join(' ')}`).includes(q)) &&
      (peligro === 'todos' || e.peligros.includes(peligro)) &&
      (categoria === 'todas' || e.categoria === categoria) &&
      (nivel === 'todos' || e.nivelMaximo === nivel));
  }, [texto, peligro, categoria, nivel]);

  const actual = sim.reproductor.escenario?.id;

  return (
    <div className="pestana-escenarios">
      <section className="tarjeta-guion">
        <div>
          <h3>Guion de la demo</h3>
          <p>{GUION.length} escenarios que recorren los cinco peligros, unos cinco minutos. Entre uno y otro espera «Siguiente».</p>
          <ol className="guion-lista">{GUION.map((e) => <li key={e.id}>{e.nombre}</li>)}</ol>
        </div>
        <button className="boton boton-primario" onClick={() => sim.reproducirGuion()}><Icono nombre="reproducir" tamano={16} /> Reproducir guion</button>
      </section>

      <div className="filtros-escenarios">
        <label className="buscador">
          <Icono nombre="buscar" tamano={16} />
          <span className="sr-only">Buscar escenarios</span>
          <input type="search" placeholder="Buscar: hueso, EVA, ánimo…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <div className="campo-doble">
          <label className="campo">
            <span className="campo-etiqueta">Peligro de la NASA</span>
            <select value={peligro} onChange={(e) => setPeligro(e.target.value as Peligro | 'todos')}>
              <option value="todos">Todos</option>
              {PELIGROS.map((p) => <option key={p} value={p}>{NOMBRE_PELIGRO[p]}</option>)}
            </select>
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Categoría</span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaEscenario | 'todas')}>
              <option value="todas">Todas</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{NOMBRE_CATEGORIA_ESCENARIO[c]}</option>)}
            </select>
          </label>
        </div>
        <div className="segmentado" role="radiogroup" aria-label="Nivel máximo">
          {NIVELES.map((n) => <button key={n.id} type="button" role="radio" aria-checked={nivel === n.id} onClick={() => setNivel(n.id)}>{n.nombre}</button>)}
        </div>
      </div>

      <p className="nota" aria-live="polite">{visibles.length} de {ESCENARIOS.length} escenarios</p>

      {CATEGORIAS.map((c) => {
        const lista = visibles.filter((e) => e.categoria === c);
        if (!lista.length) return null;
        return (
          <section key={c} className="grupo-escenarios">
            <h3 className="grupo-titulo">{NOMBRE_CATEGORIA_ESCENARIO[c]} <span>{lista.length}</span></h3>
            <ul className="tarjetas-escenario">
              {lista.map((e) => (
                <TarjetaEscenario
                  key={e.id} e={e} abierta={abierto === e.id} enCurso={actual === e.id} reproducido={sim.reproducidos.has(e.id)}
                  onAbrir={() => setAbierto(abierto === e.id ? null : e.id)}
                  onReproducir={(pausado) => sim.ejecutarEscenario(e, { pausado })}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TarjetaEscenario({ e, abierta, enCurso, reproducido, onAbrir, onReproducir }: {
  e: Escenario; abierta: boolean; enCurso: boolean; reproducido: boolean; onAbrir: () => void; onReproducir: (pausado: boolean) => void;
}) {
  const perfil = PERFILES.find((p) => p.id === e.perfil);
  return (
    <li className={`tarjeta-escenario ${abierta ? 'abierta' : ''} ${enCurso ? 'en-curso' : ''}`}>
      <button className="tarjeta-escenario-cab" onClick={onAbrir} aria-expanded={abierta}>
        <span className="escenario-fila">
          <strong>{e.nombre}</strong>
          <InsigniaNivel nivel={e.nivelMaximo} />
        </span>
        <span className="escenario-desc">{e.descripcion}</span>
        <span className="escenario-meta">
          {e.hrp.slice(0, 3).map((h) => <span key={h} className="chip-hrp">{NOMBRE_CORTO_HRP[h]}</span>)}
          {e.hrp.length > 3 && <span className="chip-hrp">+{e.hrp.length - 3}</span>}
          <span className="texto-suave">{e.pasos.length} paso{e.pasos.length > 1 ? 's' : ''} · {duracion(e)}</span>
          {reproducido && <span className="escenario-visto"><Icono nombre="check" tamano={12} /> Reproducido</span>}
        </span>
      </button>
      {abierta && (
        <div className="tarjeta-escenario-detalle">
          <p className="detalle-sub">Qué observar</p>
          <ul className="que-observar">{e.queObservar.map((q) => <li key={q}>{q}</li>)}</ul>
          {perfil && <p className="nota">Astronauta sugerido: <strong>{perfil.nombre}</strong> ({perfil.rol})</p>}
          <p className="detalle-sub">Pasos</p>
          <ol className="pasos-escenario">
            {e.pasos.map((p, i) => <li key={i}><strong>{p.titulo}.</strong> <span className="texto-suave">{p.narracion}</span></li>)}
          </ol>
          <div className="acciones-escenario">
            <button className="boton boton-primario" onClick={() => onReproducir(false)}><Icono nombre="reproducir" tamano={16} /> Reproducir</button>
            <button className="boton" onClick={() => onReproducir(true)}><Icono nombre="siguiente" tamano={16} /> Paso a paso</button>
          </div>
        </div>
      )}
    </li>
  );
}
