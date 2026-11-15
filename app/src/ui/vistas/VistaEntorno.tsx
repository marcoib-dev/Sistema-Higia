import { useEffect, useRef, useState } from 'react';
import { camaraDisponible, capturar, detenerCamara, iniciarCamara } from '../../adaptadores/camara/camara';
import type { AnalisisEntorno } from '../../adaptadores/ia/contrato';
import { NOMBRE_DESTINO, RETARDO_TIERRA, type Contexto } from '../../core/tipos';
import { EncabezadoSeccion, Etiqueta } from '../componentes/basicos';
import { Icono, type NombreIcono } from '../iconos';
import { useT } from '../idioma';

interface Props {
  contexto: Contexto;
  iaActiva: boolean;
  onAnalizar: (imagenBase64: string) => Promise<AnalisisEntorno>;
  onAplicar: (c: Partial<Contexto>) => void;
  onAbrirDemo: () => void;
}

const UBICACION = { habitat: 'Dentro del hábitat', eva: 'Actividad extravehicular', rover: 'En el rover' };
const ACTIVIDAD = { reposo: 'Reposo', trabajo: 'Trabajo', ejercicio: 'Ejercicio' };

/** Contexto que la IA infirió con claridad (descarta lo "desconocido"). */
export function contextoDesdeAnalisis(a: AnalisisEntorno): Partial<Contexto> {
  const c: Partial<Contexto> = {};
  if (a.ubicacion !== 'desconocida') c.ubicacion = a.ubicacion;
  if (a.destino !== 'desconocido') c.destino = a.destino;
  if (a.actividad !== 'desconocida') c.actividad = a.actividad;
  return c;
}

function Dato({ icono, titulo, valor, detalle, alerta }: { icono: NombreIcono; titulo: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className={`dato ${alerta ? 'dato-alerta' : ''}`}>
      <Icono nombre={icono} tamano={20} />
      <div>
        <span className="dato-titulo">{titulo}</span>
        <strong>{valor}</strong>
        {detalle && <span className="dato-detalle">{detalle}</span>}
      </div>
    </div>
  );
}

export function VistaEntorno({ contexto: c, iaActiva, onAnalizar, onAplicar, onAbrirDemo }: Props) {
  const t = useT();
  const enlaces = [c.companeroCercano && t('compañero cercano'), c.medicoABordo && t('médico a bordo'), c.conexionHabitat && t('hábitat'), c.conexionTierra && t('Tierra')].filter(Boolean) as string[];
  const salidas = [c.pantallaHabitat && t('pantalla del hábitat'), c.pantallaPersonal && t('pantalla personal'), c.auricular && t('auricular')].filter(Boolean) as string[];

  return (
    <>
      <EncabezadoSeccion
        titulo={t('Entorno')}
        descripcion={t('El contexto cambia cómo Higia interpreta los datos y por dónde comunica.')}
        acciones={<button className="boton" onClick={onAbrirDemo}><Icono nombre="demo" /> {t('Cambiar en el simulador')}</button>}
      />
      <div className="datos-entorno">
        <Dato icono="ubicacion" titulo={t('Ubicación')} valor={t(UBICACION[c.ubicacion])} detalle={t('Destino: {d}', { d: t(NOMBRE_DESTINO[c.destino]) })} />
        <Dato icono="actividad" titulo={t('Actividad')} valor={t(ACTIVIDAD[c.actividad])} detalle={c.actividad === 'ejercicio' ? t('Se tolera un pulso más alto') : undefined} />
        <Dato icono="sol" titulo={t('Clima espacial')} valor={c.climaEspacial === 'tormentaSolar' ? t('Tormenta solar') : t('En calma')} alerta={c.climaEspacial === 'tormentaSolar'} />
        <Dato icono="reloj" titulo={t('Hora del hábitat')} valor={`${String(c.hora).padStart(2, '0')}:00`} />
        <Dato icono="reloj" titulo={t('Día de misión')} valor={t('Día {n}', { n: c.diaMision })} detalle={c.transicionGravedad ? t('Transición de gravedad en las últimas 72 h') : undefined} alerta={c.transicionGravedad} />
        <Dato icono="personas" titulo={t('A quién se puede avisar')} valor={enlaces.length ? enlaces.join(', ') : t('Nadie al alcance')} detalle={c.conexionTierra ? t('Retardo con Tierra: {r}', { r: RETARDO_TIERRA[c.destino] }) : undefined} alerta={!enlaces.length} />
        <Dato icono="auricular" titulo={t('Canales de salida')} valor={salidas.length ? salidas.join(', ') : t('Ninguno')} alerta={!salidas.length} />
      </div>
      <Camara iaActiva={iaActiva} onAnalizar={onAnalizar} onAplicar={onAplicar} />
    </>
  );
}

function Camara({ iaActiva, onAnalizar, onAplicar }: Pick<Props, 'iaActiva' | 'onAnalizar' | 'onAplicar'>) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [encendida, setEncendida] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<AnalisisEntorno | null>(null);
  const [aplicado, setAplicado] = useState(false);

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
      setError(t('No se pudo acceder a la cámara. Revisa los permisos del navegador.'));
    }
  };

  const analizar = async (imagen: string) => {
    setAnalizando(true);
    setError('');
    setAplicado(false);
    try {
      setResultado(await onAnalizar(imagen));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Error al analizar la imagen.'));
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
  const resumenSugerido = [
    sugerido.ubicacion && t(UBICACION[sugerido.ubicacion]), sugerido.destino && t(NOMBRE_DESTINO[sugerido.destino]), sugerido.actividad && t(ACTIVIDAD[sugerido.actividad]),
  ].filter(Boolean).join(', ');

  return (
    <section className="tarjeta camara" aria-labelledby="titulo-camara">
      <div className="tarjeta-cab">
        <h2 id="titulo-camara" className="titulo-tarjeta">{t('Cámara')}</h2>
        {iaActiva ? <Etiqueta icono="ia" tono="ia">{t('Análisis con IA')}</Etiqueta> : <Etiqueta icono="sinConexion">{t('Requiere IA')}</Etiqueta>}
      </div>
      <p className="texto-suave">{t('Una foto del entorno ayuda a Higia a confirmar dónde estás, qué haces y si hay peligros a la vista.')}</p>

      <div className="camara-cuerpo">
        <div className={`camara-visor ${encendida ? '' : 'apagada'}`}>
          <video ref={video} muted playsInline />
          {!encendida && <span><Icono nombre="camara" tamano={28} />{t('Cámara apagada')}</span>}
        </div>
        <div className="camara-acciones">
          {camaraDisponible() && (
            <button className="boton" onClick={() => void alternar()}><Icono nombre="camara" /> {encendida ? t('Apagar cámara') : t('Encender cámara')}</button>
          )}
          <button className="boton boton-primario" disabled={!encendida || !iaActiva || analizando} onClick={() => void analizar(capturar(video.current!))}>
            <Icono nombre="ia" /> {analizando ? t('Analizando…') : t('Analizar entorno')}
          </button>
          <label className={`boton ${!iaActiva || analizando ? 'deshabilitado' : ''}`}>
            <Icono nombre="subir" /> {t('Subir foto')}
            <input type="file" accept="image/*" className="sr-only" disabled={!iaActiva || analizando} onChange={(e) => desdeArchivo(e.target.files?.[0])} />
          </label>
          {!iaActiva && <p className="nota">{t('El análisis requiere la IA: configura DEEPSEEK_API_KEY en app/.env.local y reinicia el servidor.')}</p>}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {resultado && (
        <div className="analisis">
          <p>{resultado.descripcion}</p>
          {resultado.peligros.length > 0 && (
            <p className="analisis-peligros"><Icono nombre="alerta" tamano={16} /> {resultado.peligros.join(' · ')}</p>
          )}
          <p className="texto-suave">{resultado.recomendacion}</p>
          {resumenSugerido ? (
            <button className="boton" disabled={aplicado} onClick={() => { onAplicar(sugerido); setAplicado(true); }}>
              <Icono nombre="check" /> {aplicado ? t('Contexto actualizado') : t('Usar como contexto: {x}', { x: resumenSugerido })}
            </button>
          ) : <p className="nota">{t('La imagen no permite inferir ubicación, destino ni actividad.')}</p>}
        </div>
      )}
    </section>
  );
}
