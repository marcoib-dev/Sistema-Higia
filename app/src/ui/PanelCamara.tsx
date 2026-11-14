import { useEffect, useRef, useState } from 'react';
import { camaraDisponible, capturar, detenerCamara, iniciarCamara } from '../adaptadores/camara/camara';
import type { AnalisisEntorno } from '../adaptadores/ia/contrato';
import { NOMBRE_DESTINO, type Contexto } from '../core/tipos';

interface Props {
  iaActiva: boolean;
  onAnalizar: (imagenBase64: string) => Promise<AnalisisEntorno>;
  onAplicar: (c: Partial<Contexto>) => void;
}

/** Contexto que la IA infirió con claridad (descarta lo "desconocido"). */
export function contextoDesdeAnalisis(a: AnalisisEntorno): Partial<Contexto> {
  const c: Partial<Contexto> = {};
  if (a.ubicacion !== 'desconocida') c.ubicacion = a.ubicacion;
  if (a.destino !== 'desconocido') c.destino = a.destino;
  if (a.actividad !== 'desconocida') c.actividad = a.actividad;
  return c;
}

export function PanelCamara({ iaActiva, onAnalizar, onAplicar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [encendida, setEncendida] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<AnalisisEntorno | null>(null);

  useEffect(() => () => detenerCamara(stream.current), []);

  const alternar = async () => {
    setError('');
    if (encendida) {
      detenerCamara(stream.current);
      stream.current = null;
      setEncendida(false);
      return;
    }
    try {
      stream.current = await iniciarCamara(video.current!);
      setEncendida(true);
    } catch {
      setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
    }
  };

  const analizar = async (imagen: string) => {
    setAnalizando(true);
    setError('');
    try {
      setResultado(await onAnalizar(imagen));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al analizar.');
    } finally {
      setAnalizando(false);
    }
  };

  const desdeArchivo = (archivo: File | undefined) => {
    if (!archivo) return;
    const img = new Image();
    img.onload = () => { void analizar(capturar(img)); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(archivo);
  };

  const sugerido = resultado ? contextoDesdeAnalisis(resultado) : {};

  return (
    <section className="tarjeta">
      <div className="tarjeta-cab">
        <h2>Entorno por cámara</h2>
        <span className={`chip ${iaActiva ? 'chip-ia' : 'chip-borde'}`}>{iaActiva ? '✨ IA' : 'Requiere conexión'}</span>
      </div>
      <video ref={video} className={`video ${encendida ? '' : 'oculto'}`} muted playsInline />
      <div className="fila-botones">
        {camaraDisponible() && <button onClick={() => void alternar()}>{encendida ? 'Apagar cámara' : 'Encender cámara'}</button>}
        <button disabled={!encendida || !iaActiva || analizando} onClick={() => void analizar(capturar(video.current!))}>
          {analizando ? 'Analizando…' : 'Analizar entorno'}
        </button>
        <label className={`boton-archivo ${!iaActiva || analizando ? 'deshabilitado' : ''}`}>
          Subir foto
          <input type="file" accept="image/*" disabled={!iaActiva || analizando} onChange={(e) => desdeArchivo(e.target.files?.[0])} />
        </label>
      </div>
      {!iaActiva && <p className="sub nota">El análisis de imagen corre en la computadora del hábitat: activa la conexión y configura la IA.</p>}
      {error && <p className="error">{error}</p>}
      {resultado && (
        <div className="analisis">
          <p>{resultado.descripcion}</p>
          {resultado.peligros.length > 0 && <p>⚠️ Peligros: {resultado.peligros.join(' · ')}</p>}
          <p className="sub">{resultado.recomendacion}</p>
          {Object.keys(sugerido).length > 0 ? (
            <button onClick={() => onAplicar(sugerido)}>
              Aplicar al contexto: {[
                sugerido.ubicacion, sugerido.destino && NOMBRE_DESTINO[sugerido.destino], sugerido.actividad,
              ].filter(Boolean).join(', ')}
            </button>
          ) : <p className="sub nota">La imagen no permite inferir ubicación, destino ni actividad.</p>}
        </div>
      )}
    </section>
  );
}
