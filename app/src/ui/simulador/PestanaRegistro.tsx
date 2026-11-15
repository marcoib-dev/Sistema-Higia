/** Pestaña Registro: qué inyectó el simulador y qué hizo Higia, del más nuevo al más viejo. */
import { useState } from 'react';
import { NOMBRE_TIPO_EVENTO, type RegistroSimulacion, type TipoEvento } from '../../adaptadores/simulador/registro';
import { InsigniaNivel, Vacio } from '../componentes/basicos';
import { Icono } from '../iconos';
import { useIdioma, useT } from '../idioma';

const TIPOS = Object.keys(NOMBRE_TIPO_EVENTO) as TipoEvento[];

export function PestanaRegistro({ registro }: { registro: RegistroSimulacion }) {
  const t = useT();
  const { idioma } = useIdioma();
  const [filtro, setFiltro] = useState<TipoEvento | 'todos'>('todos');
  const [copiado, setCopiado] = useState(false);
  const eventos = registro.lista().filter((e) => filtro === 'todos' || e.tipo === filtro);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(registro.comoTexto());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* sin permiso de portapapeles */ }
  };

  return (
    <div className="pestana-registro">
      <div className="acciones-datos">
        <label className="campo campo-linea">
          <span className="campo-etiqueta">{t('Mostrar')}</span>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as TipoEvento | 'todos')}>
            <option value="todos">{t('Todo')}</option>
            {TIPOS.map((tipo) => <option key={tipo} value={tipo}>{t(NOMBRE_TIPO_EVENTO[tipo])}</option>)}
          </select>
        </label>
        <button className="boton" onClick={copiar} disabled={!registro.cantidad}>
          <Icono nombre={copiado ? 'check' : 'copiar'} tamano={16} /> {copiado ? t('Copiado') : t('Copiar como texto')}
        </button>
      </div>
      {eventos.length === 0 ? (
        <Vacio icono="documento" titulo={t('Sin eventos todavía')}>{t('Reproduce un escenario: acá queda cada paso y por qué Higia eligió cada canal.')}</Vacio>
      ) : (
        <ol className="linea-registro">
          {eventos.map((e) => (
            <li key={e.id} className={`evento tipo-${e.tipo}`}>
              <time>{new Date(e.t).toLocaleTimeString(idioma === 'en' ? 'en-GB' : 'es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
              <div>
                <p className="evento-cab"><span className="evento-tipo">{t(NOMBRE_TIPO_EVENTO[e.tipo])}</span>{e.nivel && <InsigniaNivel nivel={e.nivel} />}</p>
                <p>{e.texto}</p>
                {e.detalle && <p className="evento-detalle">{e.detalle}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
