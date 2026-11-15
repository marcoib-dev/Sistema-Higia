/**
 * ACCESO A HIGIA desde cualquier sección: el asistente es la base de la app, así que siempre está a mano.
 * Muestra si está escuchando su nombre, la última respuesta y permite escribirle o dictarle.
 */
import { useEffect, useState } from 'react';
import { TEXTO_ACTIVIDAD, TEXTO_ESCUCHA, type Asistente } from '../asistente';
import { Icono } from '../iconos';
import { useT } from '../idioma';
import { OrbeHigia } from './AuraHigia';

export function AccesoHigia({ asistente: a, onAbrir }: { asistente: Asistente; onAbrir: () => void }) {
  const t = useT();
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ultimo = a.historial[0];
  const [verUltimo, setVerUltimo] = useState(false);

  // La última respuesta se muestra unos segundos y se oculta sola.
  useEffect(() => {
    if (!ultimo) return;
    setVerUltimo(true);
    const id = setTimeout(() => setVerUltimo(false), 9000);
    return () => clearTimeout(id);
  }, [ultimo?.id]);

  const estado = a.actividad === 'escuchando' && a.parcial ? `«${a.parcial}»`
    : a.actividad === 'inactiva' || a.actividad === 'esperando' ? t(TEXTO_ESCUCHA[a.estadoEscucha]) : t(TEXTO_ACTIVIDAD[a.actividad]);

  return (
    <div data-tutorial="acceso-higia" className={`acceso-higia actividad-${a.actividad}`} aria-label={t('Asistente Higia')}>
      {verUltimo && ultimo && !abierto && (
        <div className="acceso-burbuja" role="status">
          {ultimo.pregunta && <p className="acceso-pregunta">«{ultimo.pregunta}»</p>}
          <p>{ultimo.respuesta}</p>
          {ultimo.hechos.length > 0 && <ul className="hechos">{ultimo.hechos.map((h) => <li key={h}><Icono nombre="check" tamano={14} /> {h}</li>)}</ul>}
        </div>
      )}
      {abierto && (
        <form className="acceso-redactor" onSubmit={(e) => { e.preventDefault(); void a.enviar(texto); setTexto(''); }}>
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t('Pídele algo a Higia')} aria-label={t('Mensaje para Higia')} />
          <button type="submit" className="boton-icono" disabled={!texto.trim() || a.pensando} aria-label={t('Enviar')}><Icono nombre="enviar" /></button>
        </form>
      )}
      <div className="acceso-barra">
        <button className="acceso-estado" onClick={onAbrir} title={t('Abrir el asistente')}>
          <OrbeHigia actividad={a.actividad === 'inactiva' ? 'esperando' : a.actividad} tamano={30} />
          <span>{estado}</span>
        </button>
        <button className="boton-icono" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-label={t('Escribirle a Higia')} title={t('Escribirle a Higia')}>
          <Icono nombre={abierto ? 'cerrar' : 'asistente'} />
        </button>
        {a.micDisponible && (
          <button className={`boton-mic pequeno ${a.dictando ? 'escuchando' : ''}`} onClick={a.dictar} disabled={a.dictando} aria-label={t('Hablarle a Higia')} title={t('Hablarle a Higia (sin decir su nombre)')}> 
            <Icono nombre="microfono" tamano={18} />
          </button>
        )}
      </div>
    </div>
  );
}
