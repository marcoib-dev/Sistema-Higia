import { useState } from 'react';
import { escuchar, reconocimientoDisponible } from '../adaptadores/voz/voz';

export interface Intercambio { id: number; pregunta: string; respuesta: string }

interface Props {
  historial: Intercambio[];
  onFrase: (frase: string) => void;
}

const EJEMPLOS = ['¿Cómo está mi presión?', 'Dormí cinco horas', '¿Cómo estoy?', 'Hice 30 minutos de ejercicio'];

export function PanelConversacion({ historial, onFrase }: Props) {
  const [texto, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);

  const enviar = (f: string) => {
    if (!f.trim()) return;
    onFrase(f.trim());
    setTexto('');
  };

  const microfono = () => {
    setEscuchando(true);
    escuchar((t) => enviar(t), () => setEscuchando(false));
  };

  return (
    <section className="tarjeta">
      <h2>Modo conversacional</h2>
      <form className="conversacion" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pregunta o registra algo…" />
        {reconocimientoDisponible() && (
          <button type="button" onClick={microfono} disabled={escuchando} aria-label="Hablar">{escuchando ? '…' : '🎙'}</button>
        )}
        <button type="submit">Enviar</button>
      </form>
      <div className="ejemplos">
        {EJEMPLOS.map((e) => <button key={e} className="enlace" onClick={() => enviar(e)}>{e}</button>)}
      </div>
      <ol className="chat">
        {historial.map((i) => (
          <li key={i.id}><p className="yo">{i.pregunta}</p><p className="sistema">{i.respuesta}</p></li>
        ))}
      </ol>
    </section>
  );
}
