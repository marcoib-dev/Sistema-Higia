import { useEffect, useRef, useState } from 'react';
import { detener, escuchar, hablar, reconocimientoDisponible } from '../../adaptadores/voz/voz';
import { EncabezadoSeccion, Etiqueta, Interruptor } from '../componentes/basicos';
import { Icono } from '../iconos';

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
  iaActiva: boolean;
  onFrase: (frase: string) => Promise<ResultadoConversacion>;
}

const SUGERENCIAS = ['¿Cómo estoy?', '¿Cómo está mi presión?', 'Anoche dormí como cinco horas y me siento cansado', 'Hice 30 minutos de bici'];

export function VistaAsistente({ historial, vozActiva, iaActiva, onFrase }: Props) {
  const [texto, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [manosLibres, setManosLibres] = useState(false);
  const manosLibresRef = useRef(manosLibres);
  manosLibresRef.current = manosLibres;
  const cancelarEscucha = useRef<() => void>(() => {});
  const fin = useRef<HTMLDivElement>(null);
  const micDisponible = reconocimientoDisponible();

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [historial.length, pensando]);
  useEffect(() => () => cancelarEscucha.current(), []);

  const enviar = async (f: string) => {
    if (!f.trim() || pensando) return;
    setTexto('');
    setPensando(true);
    try {
      const r = await onFrase(f.trim());
      // Interfaz natural: responde por voz y, en manos libres, vuelve a escuchar al terminar.
      const continuar = () => { if (manosLibresRef.current) abrirMicrofono(); };
      if (vozActiva) hablar(r.texto, continuar);
      else continuar();
    } finally {
      setPensando(false);
    }
  };

  const abrirMicrofono = () => {
    detener(); // hablarle a Higia la interrumpe
    setEscuchando(true);
    cancelarEscucha.current = escuchar((t) => void enviar(t), () => setEscuchando(false));
  };

  const alternarManosLibres = (v: boolean) => {
    setManosLibres(v);
    if (v && !escuchando) abrirMicrofono();
    if (!v) cancelarEscucha.current();
  };

  // El historial llega del más nuevo al más viejo; en un chat se lee de arriba hacia abajo.
  const cronologico = [...historial].reverse();

  return (
    <div className="asistente">
      <EncabezadoSeccion
        titulo="Asistente"
        descripcion={iaActiva
          ? 'Habla con naturalidad: Higia entiende frases libres y registra los datos que mencionas.'
          : 'Sin conexión: responde el intérprete local por palabras clave.'}
        acciones={iaActiva ? <Etiqueta icono="ia" tono="ia">IA activa</Etiqueta> : <Etiqueta icono="sinConexion">Modo local</Etiqueta>}
      />

      <section className="tarjeta chat" aria-label="Conversación">
        <div className="chat-historial" aria-live="polite">
          {cronologico.length === 0 && !pensando && (
            <div className="chat-bienvenida">
              <p>Pregúntale a Higia por tu estado o cuéntale cómo te sientes.</p>
              <div className="sugerencias">
                {SUGERENCIAS.map((s) => <button key={s} className="sugerencia" onClick={() => void enviar(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {cronologico.map((i) => (
            <div key={i.id} className="chat-turno">
              <p className="burbuja burbuja-yo">{i.pregunta}</p>
              <div className="burbuja burbuja-higia">
                <span className="burbuja-autor">{i.fuente === 'ia' ? 'Higia · IA' : 'Higia · local'}</span>
                <p>{i.respuesta}</p>
                {i.nota && <p className="burbuja-nota">{i.nota}</p>}
              </div>
            </div>
          ))}
          {pensando && <p className="burbuja burbuja-higia pensando">Higia está pensando…</p>}
          <div ref={fin} />
        </div>

        <form className="chat-redactor" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
          {micDisponible && (
            <button
              type="button" className={`boton-mic ${escuchando ? 'escuchando' : ''}`} onClick={abrirMicrofono} disabled={escuchando}
              aria-label={escuchando ? 'Escuchando…' : 'Hablar'} title="Hablar"
            >
              <Icono nombre="microfono" tamano={20} />
            </button>
          )}
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={escuchando ? 'Escuchando…' : 'Escribe o usa el micrófono'} aria-label="Mensaje para Higia" />
          <button type="submit" className="boton boton-primario" disabled={pensando || !texto.trim()} aria-label="Enviar">
            <Icono nombre="enviar" /> <span className="ocultar-movil">Enviar</span>
          </button>
        </form>
        {micDisponible && (
          <div className="chat-opciones">
            <Interruptor etiqueta="Manos libres" descripcion="Vuelve a escuchar después de cada respuesta" activo={manosLibres} onCambio={alternarManosLibres} />
          </div>
        )}
      </section>
    </div>
  );
}
