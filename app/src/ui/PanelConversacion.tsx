import { useRef, useState } from 'react';
import { detener, escuchar, hablar, reconocimientoDisponible } from '../adaptadores/voz/voz';

export interface Intercambio {
  id: number;
  pregunta: string;
  respuesta: string;
  fuente: 'ia' | 'local';
  nota?: string;
}

export interface ResultadoConversacion {
  texto: string;
  fuente: 'ia' | 'local';
  nota?: string;
}

interface Props {
  historial: Intercambio[];
  vozActiva: boolean;
  /** true = con conexión e IA configurada: conversación natural */
  iaActiva: boolean;
  onFrase: (frase: string) => Promise<ResultadoConversacion>;
}

const EJEMPLOS = ['¿Cómo está mi presión?', 'Anoche dormí como cinco horas y me siento cansado', '¿Cómo estoy?', 'Hice 30 minutos de bici'];

export function PanelConversacion({ historial, vozActiva, iaActiva, onFrase }: Props) {
  const [texto, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [manosLibres, setManosLibres] = useState(false);
  const manosLibresRef = useRef(manosLibres);
  manosLibresRef.current = manosLibres;
  const cancelarEscucha = useRef<() => void>(() => {});
  const micDisponible = reconocimientoDisponible();

  const enviar = async (f: string) => {
    if (!f.trim() || pensando) return;
    setTexto('');
    setPensando(true);
    try {
      const r = await onFrase(f.trim());
      // NUI: responde por voz y, en manos libres, vuelve a escuchar al terminar.
      const continuar = () => { if (manosLibresRef.current) abrirMicrofono(); };
      if (vozActiva) hablar(r.texto, continuar);
      else continuar();
    } finally {
      setPensando(false);
    }
  };

  const abrirMicrofono = () => {
    detener(); // si Higia está hablando, el astronauta la interrumpe
    setEscuchando(true);
    cancelarEscucha.current = escuchar((t) => void enviar(t), () => setEscuchando(false));
  };

  const alternarManosLibres = (v: boolean) => {
    setManosLibres(v);
    if (v && !escuchando) abrirMicrofono();
    if (!v) cancelarEscucha.current();
  };

  return (
    <section className="tarjeta">
      <div className="tarjeta-cab">
        <h2>Modo conversacional</h2>
        <span className={`chip ${iaActiva ? 'chip-ia' : 'chip-borde'}`}>{iaActiva ? '✨ IA' : '⚙ Local'}</span>
      </div>
      <p className="sub nota">
        {iaActiva
          ? 'Conversación natural con IA: entiende frases libres y registra los datos que mencionas.'
          : 'Sin conexión o sin IA: responde el intérprete local por palabras clave.'}
      </p>
      <form className="conversacion" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pregunta o cuenta cómo estás…" aria-label="Mensaje para Higia" />
        {micDisponible && (
          <button type="button" onClick={abrirMicrofono} disabled={escuchando} aria-label="Hablar">{escuchando ? '👂' : '🎙'}</button>
        )}
        <button type="submit" disabled={pensando}>{pensando ? '…' : 'Enviar'}</button>
      </form>
      {micDisponible && (
        <label className="fila">
          Manos libres (escucha de nuevo tras cada respuesta)
          <input type="checkbox" checked={manosLibres} onChange={(e) => alternarManosLibres(e.target.checked)} />
        </label>
      )}
      <div className="ejemplos">
        {EJEMPLOS.map((e) => <button key={e} className="enlace" onClick={() => void enviar(e)}>{e}</button>)}
      </div>
      <ol className="chat">
        {pensando && <li><p className="sistema pensando">Higia está pensando…</p></li>}
        {historial.map((i) => (
          <li key={i.id}>
            <p className="yo">{i.pregunta}</p>
            <p className="sistema">
              <span className="fuente">{i.fuente === 'ia' ? '✨ IA' : '⚙ Local'}</span> {i.respuesta}
            </p>
            {i.nota && <p className="sub nota">{i.nota}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
