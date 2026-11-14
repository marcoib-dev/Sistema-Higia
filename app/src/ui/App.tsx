import { useCallback, useEffect, useRef, useState } from 'react';
import { AdaptadorEjemplo } from '../adaptadores/interop/ejemploNasa';
import type { Escenario } from '../adaptadores/simulador/escenarios';
import { PERFILES } from '../adaptadores/simulador/perfiles';
import { hablar } from '../adaptadores/voz/voz';
import { interpretar } from '../core/conversacion';
import { NucleoSalud } from '../core/nucleo';
import { redactar } from '../core/personalizador';
import { REGLAS } from '../core/reglas';
import { NOMBRE_SISTEMA, ORDEN_NIVEL, type Contexto, type Mensaje, type SistemaCorporal } from '../core/tipos';
import { COLOR_NIVEL, FiguraCorporal, NOMBRE_NIVEL } from './FiguraCorporal';
import { PanelComparacion } from './PanelComparacion';
import { PanelControl } from './PanelControl';
import { PanelConversacion, type Intercambio } from './PanelConversacion';
import { PanelInterop } from './PanelInterop';
import { PanelMensajes } from './PanelMensajes';

const CONTEXTO_INICIAL: Contexto = {
  ubicacion: 'habitat', hora: 10,
  pantallaHabitat: true, pantallaPersonal: true, auricular: true,
  conexionHabitat: false, conexionTierra: false,
};

export function App() {
  const [nucleo] = useState(() => new NucleoSalud(REGLAS, PERFILES[0], CONTEXTO_INICIAL));
  const [interop] = useState(() => new AdaptadorEjemplo());
  const [, setVersion] = useState(0);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [chat, setChat] = useState<Intercambio[]>([]);
  const [seleccion, setSeleccion] = useState<SistemaCorporal[] | null>(null);
  const [vozActiva, setVozActiva] = useState(true);
  const vozRef = useRef(vozActiva);
  vozRef.current = vozActiva;

  const refrescar = () => setVersion((v) => v + 1);

  const procesar = useCallback(async (nuevos: Mensaje[]) => {
    if (vozRef.current) nuevos.filter((m) => m.voz).forEach((m) => hablar(m.texto));
    if (nuevos.length) setMensajes((prev) => [...nuevos, ...prev].slice(0, 100));
    // La capa de interoperabilidad solo actúa con conexión; si no, el núcleo sigue solo.
    if (nucleo.contexto.conexionHabitat && nucleo.hayPendientesReporte()) {
      await interop.enviar(nucleo.tomarPendientesReporte(), nucleo.perfil);
    }
    refrescar();
  }, [nucleo, interop]);

  // Reevaluación periódica para recordatorios según el perfil.
  useEffect(() => {
    const id = setInterval(() => procesar(nucleo.tick()), 60_000);
    return () => clearInterval(id);
  }, [nucleo, procesar]);

  const cambiarContexto = (c: Partial<Contexto>) => procesar(nucleo.actualizarContexto(c));

  const ejecutarEscenario = (e: Escenario) => {
    const deContexto = e.contexto ? nucleo.actualizarContexto(e.contexto) : [];
    const ahora = Date.now();
    procesar([...deContexto, ...nucleo.registrar(e.lecturas(ahora, nucleo.historial), ahora)]);
  };

  const cambiarPerfil = (id: string) => {
    nucleo.cambiarPerfil(PERFILES.find((p) => p.id === id)!);
    refrescar();
  };

  const conversar = (frase: string) => {
    const r = interpretar(frase, nucleo);
    if (vozRef.current) hablar(r.texto);
    setChat((prev) => [{ id: Date.now(), pregunta: frase, respuesta: r.texto }, ...prev].slice(0, 20));
    procesar(r.lecturas.length ? nucleo.registrar(r.lecturas) : []);
  };

  const estado = nucleo.estadoCorporal();
  const ultimoRelevante = mensajes.find((m) => ORDEN_NIVEL[m.hallazgo.nivel] >= ORDEN_NIVEL.aviso);
  const hallazgosSeleccion = seleccion
    ? nucleo.hallazgosActuales().filter((h) => seleccion.includes(h.sistema))
    : [];

  return (
    <div className="app">
      <header>
        <h1>Monitor de Salud <span className="sub">· nombre por definir</span></h1>
        <p className="estado-red">
          {nucleo.contexto.conexionHabitat ? '🟢 Conectado al hábitat' : '⚪ Modo autónomo (sin conexión)'}
          {' · '}{nucleo.perfil.nombre} · {nucleo.contexto.ubicacion.toUpperCase()} · {nucleo.contexto.hora}:00
        </p>
      </header>

      <main className="rejilla">
        <div className="columna">
          <section className="tarjeta">
            <h2>Modo pasivo</h2>
            <FiguraCorporal estado={estado} seleccion={seleccion} onSeleccionar={setSeleccion} />
          </section>
          {seleccion && (
            <section className="tarjeta">
              <h2>{seleccion.map((s) => NOMBRE_SISTEMA[s]).join(' / ')}</h2>
              {hallazgosSeleccion.length ? (
                <ul className="detalle">
                  {hallazgosSeleccion.map((h) => (
                    <li key={h.riesgoId}>
                      <span className="chip" style={{ background: COLOR_NIVEL[h.nivel] }}>{NOMBRE_NIVEL[h.nivel]}</span>{' '}
                      {redactar(h, nucleo.perfil, nucleo.contexto)}
                    </li>
                  ))}
                </ul>
              ) : <p className="vacio">Sin datos para este sistema todavía.</p>}
            </section>
          )}
        </div>

        <div className="columna">
          <section className="tarjeta">
            <h2>Modo proactivo: mensajes al astronauta</h2>
            <PanelMensajes mensajes={mensajes} />
          </section>
        </div>

        <div className="columna">
          <PanelControl
            perfil={nucleo.perfil} contexto={nucleo.contexto} vozActiva={vozActiva}
            onPerfil={cambiarPerfil} onContexto={cambiarContexto} onEscenario={ejecutarEscenario} onVoz={setVozActiva}
          />
          <PanelConversacion historial={chat} onFrase={conversar} />
          <PanelComparacion mensaje={ultimoRelevante} contexto={nucleo.contexto} />
          <PanelInterop conectado={nucleo.contexto.conexionHabitat} pendientes={nucleo.hayPendientesReporte()} enviados={interop.enviados} />
        </div>
      </main>
    </div>
  );
}
