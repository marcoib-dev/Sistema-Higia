/**
 * PRUEBAS A BORDO — pruebas breves que Higia guía paso a paso y evalúa en el dispositivo.
 * Cada resultado entra como dato a las reglas y se compara con la línea base previa al vuelo.
 *
 * - Evaluación cognitiva y chequeo de orientación: se hacen conversando con Higia.
 * - Tiempo de reacción (PVT): se mide aquí, tocando cuando aparece la señal.
 * - Fuerza isométrica y maniobra de Valsalva: Higia guía con voz y cuenta regresiva; la lectura del
 *   dinamómetro o del monitor cardíaco la entrega el simulador (en el hábitat la daría el dispositivo).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PruebaGuiada } from '../../core/acciones';
import type { NucleoSalud } from '../../core/nucleo';
import { INFO_SENSOR, ORDEN_NIVEL, type Hallazgo, type Lectura, type TipoSensor } from '../../core/tipos';
import { hablar } from '../../adaptadores/voz/voz';
import { EncabezadoSeccion, Etiqueta, InsigniaNivel } from '../componentes/basicos';
import { Icono, type NombreIcono } from '../iconos';
import { useT } from '../idioma';

interface Props {
  nucleo: NucleoSalud;
  vozActiva: boolean;
  /** Prueba que pidió abrir el asistente ("Higia, quiero hacer la maniobra de Valsalva"). */
  pedida: PruebaGuiada | null;
  onPedidaAtendida: () => void;
  onRegistrar: (lecturas: Lectura[], resumen: string) => void;
  onEvaluacionCognitiva: () => void;
  onChequeoOrientacion: () => void;
}

interface Ficha {
  id: PruebaGuiada | 'cognitiva' | 'orientacion';
  nombre: string;
  icono: NombreIcono;
  tono: 'cog' | 'car' | 'mus' | 'rea';
  queMide: string;
  duracion: string;
  sensor: TipoSensor;
  riesgo: string;
  regla: string;
  formato: (v: number) => string;
  /** Más alto es mejor (salvo el tiempo de reacción). */
  mejorAlto: boolean;
}

const FICHAS: Ficha[] = [
  {
    id: 'cognitiva', nombre: 'Evaluación cognitiva', icono: 'cerebro', tono: 'cog', sensor: 'cognicion', regla: 'mental.orientacion',
    queMide: 'Memoria, atención, cálculo, orientación y razonamiento. Seis preguntas conversando con Higia.',
    duracion: '~2 min', riesgo: 'HRP 7.2.1 conducta', formato: (v) => `${v}/100`, mejorAlto: true,
  },
  {
    id: 'reaccion', nombre: 'Tiempo de reacción (PVT)', icono: 'rayo', tono: 'rea', sensor: 'tiempoReaccion', regla: 'mental.orientacion',
    queMide: 'Vigilancia y fatiga: toca en cuanto aparezca la señal. Se alarga con la falta de sueño.',
    duracion: '~1 min', riesgo: 'HRP 7.2.3 sueño', formato: (v) => `${Math.round(v)} ms`, mejorAlto: false,
  },
  {
    id: 'isometrica', nombre: 'Fuerza isométrica', icono: 'mano', tono: 'mus', sensor: 'fuerzaIsometrica', regla: 'musculo.isometrica',
    queMide: 'Contracción máxima sostenida con el dinamómetro de mano. Detecta pérdida de fuerza en microgravedad.',
    duracion: '~1 min', riesgo: 'HRP 7.1.9 aptitud', formato: (v) => `${coma(v)} kg`, mejorAlto: true,
  },
  {
    id: 'valsalva', nombre: 'Maniobra de Valsalva', icono: 'corazon', tono: 'car', sensor: 'valsalva', regla: 'cardio.valsalva',
    queMide: 'Reflejo autonómico del corazón: predice mareo o desmayo al volver a la gravedad (aterrizaje, regreso).',
    duracion: '~1 min', riesgo: 'HRP 7.1.3 cardiovascular', formato: (v) => coma(v.toFixed(2)), mejorAlto: true,
  },
  {
    id: 'orientacion', nombre: 'Chequeo de orientación', icono: 'brujula', tono: 'cog', sensor: 'orientacion', regla: 'mental.orientacion',
    queMide: 'Cuatro preguntas: quién eres, dónde estás, qué mes es y una resta. Se usa tras un golpe o ante confusión.',
    duracion: '~30 s', riesgo: 'HRP 7.2.1 conducta', formato: (v) => `${v}/10`, mejorAlto: true,
  },
];

const coma = (x: string | number) => String(x).replace('.', ',');

const hace = (t: (s: string, v?: Record<string, string | number>) => string, ts: number, ahora: number) => {
  const min = Math.round((ahora - ts) / 60_000);
  return min < 1 ? t('ahora') : min < 60 ? t('hace {n} min', { n: min }) : min < 48 * 60 ? t('hace {n} h', { n: Math.round(min / 60) }) : t('hace {n} días', { n: Math.round(min / 1440) });
};

/** Contraindicaciones según lo que Higia ya sabe (hallazgos, últimas lecturas, contexto, historia clínica). */
function contraindicaciones(prueba: PruebaGuiada, n: NucleoSalud): string[] {
  const motivos: string[] = [];
  const activos = n.hallazgosActuales().filter((h) => ORDEN_NIVEL[h.nivel] >= ORDEN_NIVEL.aviso);
  const sistolica = n.historial.ultima('presionSistolica');
  const pio = n.historial.ultima('presionIntraocular');
  const cardioAlerta = activos.find((h) => h.sistema === 'corazon' && h.nivel === 'alerta');
  if (n.contexto.ubicacion === 'eva') motivos.push('Estás en una EVA: haz la prueba dentro del hábitat.');
  if (cardioAlerta) motivos.push(`Hay una alerta cardíaca activa (${cardioAlerta.titulo}).`);
  if (prueba === 'valsalva') {
    const ojos = activos.find((h) => h.sistema === 'ojos');
    if (ojos) motivos.push(`El pujo sube la presión dentro del ojo y del cráneo, y hay un hallazgo activo: ${ojos.titulo}.`);
    else if (pio && pio.valor > 21) motivos.push(`Tu presión intraocular reciente es ${pio.valor} mmHg: el pujo la eleva.`);
    if (n.perfil.historiaClinica.cirugias.some((c) => /ojo|retina|catarata/i.test(c))) motivos.push('Tienes una cirugía ocular en tu historia clínica.');
  }
  if (prueba === 'isometrica' && sistolica && sistolica.valor >= 160) {
    motivos.push(`Tu presión sistólica reciente es ${sistolica.valor} mmHg: el esfuerzo isométrico la sube más.`);
  }
  return motivos;
}

export function VistaPruebas({ nucleo: n, vozActiva, pedida, onPedidaAtendida, onRegistrar, onEvaluacionCognitiva, onChequeoOrientacion }: Props) {
  const t = useT();
  const [abierta, setAbierta] = useState<PruebaGuiada | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const ahora = Date.now();

  useEffect(() => {
    if (!pedida) return;
    setAbierta(pedida);
    onPedidaAtendida();
  }, [pedida, onPedidaAtendida]);

  useEffect(() => { if (abierta) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [abierta]);

  const decir = useCallback((t: string) => { if (vozActiva) hablar(t); }, [vozActiva]);

  const empezar = (f: Ficha) => {
    if (f.id === 'cognitiva') onEvaluacionCognitiva();
    else if (f.id === 'orientacion') onChequeoOrientacion();
    else setAbierta(f.id);
  };

  const registrar = (lecturas: Lectura[], resumen: string) => {
    onRegistrar(lecturas, resumen);
    setAbierta(null);
  };

  return (
    <div className="pruebas">
      <EncabezadoSeccion
        titulo={t('Pruebas a bordo')}
        descripcion={t('Pruebas breves que Higia guía y evalúa en el dispositivo, sin conexión. Cada resultado se compara con tu valor habitual antes del vuelo.')}
      />

      <div ref={panel} className="ancla-prueba">
        {abierta === 'reaccion' && <PruebaReaccion n={n} decir={decir} onCancelar={() => setAbierta(null)} onRegistrar={registrar} />}
        {abierta === 'isometrica' && <PruebaIsometrica n={n} decir={decir} onCancelar={() => setAbierta(null)} onRegistrar={registrar} />}
        {abierta === 'valsalva' && <PruebaValsalva n={n} decir={decir} onCancelar={() => setAbierta(null)} onRegistrar={registrar} />}
      </div>

      <div className="pruebas-grilla">
        {FICHAS.map((f) => {
          const ult = n.historial.ultima(f.sensor);
          const base = n.perfil.lineaBase[f.sensor];
          const h: Hallazgo | undefined = n.hallazgo(f.regla);
          const nivel = h && ult && h.datos?.some((d) => d.sensor === f.sensor) ? h.nivel : ult ? 'normal' : 'sinDatos';
          return (
            <article key={f.id} className={`tarjeta tarjeta-prueba ${abierta === f.id ? 'activa' : ''}`}>
              <div className="tarjeta-prueba-cab">
                <span className={`prueba-icono ${f.tono}`}><Icono nombre={f.icono} tamano={22} /></span>
                <div>
                  <h2>{t(f.nombre)}</h2>
                  <div className="prueba-meta"><Etiqueta icono="reloj">{f.duracion}</Etiqueta><Etiqueta tono="nasa">{t(f.riesgo)}</Etiqueta></div>
                </div>
              </div>
              <p className="que-mide">{t(f.queMide)}</p>
              <div className="prueba-resultado">
                {ult ? (
                  <>
                    <b>{f.formato(ult.valor)}</b>
                    <InsigniaNivel nivel={nivel} />
                    <small>{hace(t, ult.timestamp, ahora)}{base !== undefined ? ` · ${t('habitual {v}', { v: f.formato(base) })}` : ''}</small>
                  </>
                ) : <small>{t('Todavía no hay resultados.')}</small>}
              </div>
              <div className="prueba-pie">
                <small className="texto-suave">{f.id === 'cognitiva' || f.id === 'orientacion' ? t('Se hace conversando con Higia') : t('Guiada paso a paso')}</small>
                <button className="boton boton-primario" onClick={() => empezar(f)} disabled={abierta === f.id}>
                  <Icono nombre="reproducir" tamano={16} /> {t('Empezar')}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ── Piezas comunes de las pruebas guiadas ───────────────────────────────

interface PropsPrueba {
  n: NucleoSalud;
  decir: (t: string) => void;
  onCancelar: () => void;
  onRegistrar: (lecturas: Lectura[], resumen: string) => void;
}

/** Cuenta regresiva en un anillo. Llama a `alTerminar` una vez al llegar a cero. */
function CuentaAtras({ segundos, etiqueta, esfuerzo, alTerminar, children }: {
  segundos: number; etiqueta: string; esfuerzo?: boolean; alTerminar: () => void; children?: ReactNode;
}) {
  const t = useT();
  const [resta, setResta] = useState(segundos);
  const fin = useRef(alTerminar);
  fin.current = alTerminar;
  useEffect(() => {
    setResta(segundos);
    const inicio = Date.now();
    const id = setInterval(() => {
      const r = Math.max(0, segundos - Math.floor((Date.now() - inicio) / 1000));
      setResta(r);
      if (r === 0) { clearInterval(id); fin.current(); }
    }, 200);
    return () => clearInterval(id);
  }, [segundos, etiqueta]);
  const C = 2 * Math.PI * 70;
  return (
    <div className="cuenta-atras">
      <div className={`anillo ${esfuerzo ? 'esfuerzo' : ''}`} role="timer" aria-label={t('{etiqueta}: {n} segundos', { etiqueta, n: resta })}>
        <svg viewBox="0 0 160 160" aria-hidden>
          <circle className="fondo-anillo" cx="80" cy="80" r="70" />
          <circle className="avance" cx="80" cy="80" r="70" strokeDasharray={C} strokeDashoffset={C * (1 - resta / segundos)} />
        </svg>
        <div className="anillo-texto"><b>{resta}</b><small>{etiqueta}</small></div>
      </div>
      {children}
    </div>
  );
}

function Advertencias({ motivos }: { motivos: string[] }) {
  const t = useT();
  if (!motivos.length) return null;
  return (
    <div className="advertencia-prueba" role="alert">
      <Icono nombre="alerta" />
      <div>
        <strong>{t('Higia no recomienda hacer esta prueba ahora.')}</strong>
        <ul>{motivos.map((m) => <li key={m}>{m}</li>)}</ul>
        {t('Si la haces igual, que sea con un compañero al lado.')}
      </div>
    </div>
  );
}

function Pasos({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <ol className="lista-pasos">
      {pasos.map((p, i) => <li key={p} className={i < actual ? 'hecho' : i === actual ? 'actual' : ''}>{p}</li>)}
    </ol>
  );
}

const ruido = (x: number, pct: number) => x * (1 + (Math.random() * 2 - 1) * pct);
const r1 = (x: number) => Math.round(x * 2) / 2;

// ── Fuerza isométrica ──────────────────────────────────────────────────

function PruebaIsometrica({ n, decir, onCancelar, onRegistrar }: PropsPrueba) {
  const t = useT();
  const PASOS = [
    'Siéntate derecho, con el codo a 90° pegado al cuerpo y la muñeca recta.',
    'Intento 1: aprieta el dinamómetro con toda tu fuerza durante 5 segundos. No contengas el aire.',
    'Descansa 10 segundos con la mano suelta.',
    'Intento 2: aprieta otra vez con toda tu fuerza, 5 segundos.',
    'Revisa la lectura y regístrala.',
  ];
  const [paso, setPaso] = useState(0);
  const motivos = useMemo(() => contraindicaciones('isometrica', n), [n]);
  const base = n.perfil.lineaBase.fuerzaIsometrica ?? 40;
  // Lectura simulada: la última medición (o la línea base) con algo de variación entre intentos.
  const referencia = n.historial.ultima('fuerzaIsometrica')?.valor ?? base * 0.96;
  const [intentos, setIntentos] = useState<[number, number]>(() => [r1(ruido(referencia, 0.04)), r1(ruido(referencia, 0.04))]);

  useEffect(() => { decir(PASOS[paso]); }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  const mejor = Math.max(...intentos);
  const caida = (base - mejor) / base;
  const avanzar = () => setPaso((p) => Math.min(PASOS.length - 1, p + 1));

  return (
    <section className="tarjeta panel-prueba" aria-label={t('Prueba de fuerza isométrica')}>
      <div className="tarjeta-cab">
        <h2 className="titulo-tarjeta"><Icono nombre="mano" /> {t('Fuerza isométrica · dinamómetro de mano')}</h2>
        <button className="boton-icono" onClick={onCancelar} aria-label={t('Cancelar la prueba')}><Icono nombre="cerrar" /></button>
      </div>
      <Advertencias motivos={motivos} />
      <div className="panel-prueba-cuerpo">
        <Pasos pasos={PASOS} actual={paso} />
        <div>
          {paso === 0 && <button className="boton boton-primario" onClick={avanzar}>{t('Estoy listo')}</button>}
          {paso === 1 && <CuentaAtras segundos={5} etiqueta={t('¡aprieta!')} esfuerzo alTerminar={avanzar} />}
          {paso === 2 && <CuentaAtras segundos={10} etiqueta={t('descansa')} alTerminar={avanzar} />}
          {paso === 3 && <CuentaAtras segundos={5} etiqueta={t('¡aprieta!')} esfuerzo alTerminar={avanzar} />}
          {paso === 4 && (
            <div className="lectura-sim">
              <div className="campos">
                {intentos.map((v, i) => (
                  <label key={i} className="campo">
                    <span className="campo-etiqueta">{t('Intento {n} (kg)', { n: i + 1 })}</span>
                    <input type="number" step={0.5} min={5} max={90} value={v}
                      onChange={(e) => setIntentos((xs) => { const c = [...xs] as [number, number]; c[i] = Number(e.target.value); return c; })} />
                  </label>
                ))}
              </div>
              <p className="resultado-calc">{t('Mejor intento:')} <b>{coma(mejor)} kg</b> · {t('habitual {v}', { v: `${coma(base)} kg` })} ({caida > 0 ? '−' : '+'}{Math.abs(Math.round(caida * 100))} %)</p>
              <small className="nota">{t('Lectura simulada del dinamómetro; puedes corregirla.')}</small>
            </div>
          )}
        </div>
      </div>
      <div className="acciones-prueba">
        {paso === 4 && (
          <button className="boton boton-ok" onClick={() => onRegistrar(
            [{ sensor: 'fuerzaIsometrica', valor: mejor, timestamp: Date.now(), fuente: 'sensor' }],
            `Prueba de fuerza isométrica: ${coma(mejor)} kilos, tu habitual es ${coma(base)}.`,
          )}><Icono nombre="check" /> {t('Registrar resultado')}</button>
        )}
        {paso > 0 && paso < 4 && <button className="boton" onClick={avanzar}>{t('Saltar paso')}</button>}
        <button className="boton boton-fantasma" onClick={onCancelar}>{t('Cancelar')}</button>
      </div>
    </section>
  );
}

// ── Maniobra de Valsalva ───────────────────────────────────────────────

function PruebaValsalva({ n, decir, onCancelar, onRegistrar }: PropsPrueba) {
  const t = useT();
  const PASOS = [
    'Siéntate derecho con el monitor cardíaco puesto y la boquilla del manómetro en la mano.',
    'Toma aire y sopla contra la boquilla manteniendo la aguja en 40 mmHg durante 15 segundos.',
    'Suelta y respira normal. Quédate sentado mientras mido tu pulso.',
    'Revisa la lectura y regístrala.',
  ];
  const [paso, setPaso] = useState(0);
  const [presion, setPresion] = useState(0);
  const motivos = useMemo(() => contraindicaciones('valsalva', n), [n]);
  const base = n.perfil.lineaBase.valsalva ?? 1.5;
  const fcBase = n.perfil.lineaBase.frecuenciaCardiaca ?? 64;
  // Lectura simulada del monitor: en transición de gravedad el reflejo responde menos.
  const cociente = (n.historial.ultima('valsalva')?.valor ?? base) * (n.contexto.transicionGravedad ? 0.78 : 1);
  const [fc, setFc] = useState(() => {
    const min = Math.round(ruido(fcBase, 0.05));
    return { max: Math.round(min * ruido(cociente, 0.03)), min };
  });

  useEffect(() => { decir(PASOS[paso]); }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manómetro simulado mientras sopla.
  useEffect(() => {
    if (paso !== 1) { setPresion(0); return; }
    const id = setInterval(() => setPresion(Math.round(ruido(40, 0.08))), 300);
    return () => clearInterval(id);
  }, [paso]);

  const valor = fc.min > 0 ? Math.round((fc.max / fc.min) * 100) / 100 : 0;
  const avanzar = () => setPaso((p) => Math.min(PASOS.length - 1, p + 1));

  return (
    <section className="tarjeta panel-prueba" aria-label={t('Maniobra de Valsalva')}>
      <div className="tarjeta-cab">
        <h2 className="titulo-tarjeta"><Icono nombre="corazon" /> {t('Maniobra de Valsalva · reflejo autonómico')}</h2>
        <button className="boton-icono" onClick={onCancelar} aria-label={t('Cancelar la prueba')}><Icono nombre="cerrar" /></button>
      </div>
      <Advertencias motivos={motivos} />
      <div className="panel-prueba-cuerpo">
        <Pasos pasos={PASOS} actual={paso} />
        <div>
          {paso === 0 && <button className="boton boton-primario" onClick={avanzar}>{motivos.length ? t('Hacerla igual') : t('Estoy listo')}</button>}
          {paso === 1 && (
            <CuentaAtras segundos={15} etiqueta={t('sopla')} esfuerzo alTerminar={avanzar}>
              <div className="manometro" aria-label={t('Manómetro: {n} mmHg', { n: presion })}>
                <span>{t('Manómetro:')} <b>{presion} mmHg</b> ({t('objetivo 40')})</span>
                <div className="manometro-pista"><span style={{ width: `${Math.min(100, (presion / 60) * 100)}%` }} /><i /></div>
              </div>
            </CuentaAtras>
          )}
          {paso === 2 && <CuentaAtras segundos={15} etiqueta={t('respira')} alTerminar={avanzar} />}
          {paso === 3 && (
            <div className="lectura-sim">
              <div className="campos">
                <label className="campo">
                  <span className="campo-etiqueta">{t('Pulso máximo al soplar')}</span>
                  <input type="number" min={30} max={220} value={fc.max} onChange={(e) => setFc((x) => ({ ...x, max: Number(e.target.value) }))} />
                </label>
                <label className="campo">
                  <span className="campo-etiqueta">{t('Pulso mínimo al soltar')}</span>
                  <input type="number" min={30} max={220} value={fc.min} onChange={(e) => setFc((x) => ({ ...x, min: Number(e.target.value) }))} />
                </label>
              </div>
              <p className="resultado-calc">{t('Cociente de Valsalva:')} <b>{coma(valor.toFixed(2))}</b> · {t('normal ≥ 1,20 · habitual {v}', { v: coma(base.toFixed(2)) })}</p>
              <small className="nota">{t('Lectura simulada del monitor cardíaco; puedes corregirla.')}</small>
            </div>
          )}
        </div>
      </div>
      <div className="acciones-prueba">
        {paso === 3 && (
          <button className="boton boton-ok" disabled={!(valor >= INFO_SENSOR.valsalva.min && valor <= INFO_SENSOR.valsalva.max)} onClick={() => onRegistrar(
            [{ sensor: 'valsalva', valor, timestamp: Date.now(), fuente: 'sensor' }],
            `Maniobra de Valsalva: cociente ${valor.toFixed(2).replace('.', ',')}, tu habitual es ${base.toFixed(2).replace('.', ',')}.`,
          )}><Icono nombre="check" /> {t('Registrar resultado')}</button>
        )}
        {paso > 0 && paso < 3 && <button className="boton" onClick={avanzar}>{t('Saltar paso')}</button>}
        <button className="boton boton-fantasma" onClick={onCancelar}>{t('Cancelar')}</button>
      </div>
    </section>
  );
}

// ── Tiempo de reacción (PVT breve) ─────────────────────────────────────

const ENSAYOS = 5;

function PruebaReaccion({ n, decir, onCancelar, onRegistrar }: PropsPrueba) {
  const t = useT();
  type Fase = 'listo' | 'espera' | 'ya' | 'adelanto' | 'fin';
  const [fase, setFase] = useState<Fase>('listo');
  const [tiempos, setTiempos] = useState<number[]>([]);
  const [adelantos, setAdelantos] = useState(0);
  const inicio = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const base = n.perfil.lineaBase.tiempoReaccion ?? 270;
  const sueno = n.historial.ultima('horasSueno');

  useEffect(() => { decir('Toca el recuadro, o pulsa la barra espaciadora, en cuanto se ponga verde. Son cinco intentos.'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const armar = useCallback(() => {
    setFase('espera');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => { inicio.current = performance.now(); setFase('ya'); }, 1500 + Math.random() * 2500);
  }, []);

  const tocar = useCallback(() => {
    if (fase === 'listo' || fase === 'adelanto') { armar(); return; }
    if (fase === 'espera') { clearTimeout(temporizador.current); setAdelantos((x) => x + 1); setFase('adelanto'); return; }
    if (fase === 'ya') {
      const rt = Math.round(performance.now() - inicio.current);
      const nuevos = [...tiempos, rt];
      setTiempos(nuevos);
      if (nuevos.length >= ENSAYOS) setFase('fin');
      else armar();
    }
  }, [fase, tiempos, armar]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.code === 'Space' && fase !== 'fin') { e.preventDefault(); tocar(); } };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [tocar, fase]);

  const media = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
  const texto = fase === 'listo' ? <>{t('Toca para empezar')}<small>{t('Intento {n} de {total}', { n: 1, total: ENSAYOS })}</small></>
    : fase === 'espera' ? <>{t('Espera…')}<small>{t('Intento {n} de {total}', { n: tiempos.length + 1, total: ENSAYOS })}</small></>
    : fase === 'ya' ? <>{t('¡Ahora!')}</>
    : fase === 'adelanto' ? <>{t('Te adelantaste')}<small>{t('Toca para repetir el intento')}</small></>
    : <>{t('Listo: {ms} ms', { ms: media })}<small>{t('promedio de {n} intentos', { n: ENSAYOS })}</small></>;

  return (
    <section className="tarjeta panel-prueba" aria-label={t('Prueba de tiempo de reacción')}>
      <div className="tarjeta-cab">
        <h2 className="titulo-tarjeta"><Icono nombre="rayo" /> {t('Tiempo de reacción (PVT breve)')}</h2>
        <button className="boton-icono" onClick={onCancelar} aria-label={t('Cancelar la prueba')}><Icono nombre="cerrar" /></button>
      </div>
      {sueno && sueno.valor < 6 && (
        <p className="nota" style={{ marginBottom: 10 }}>{t('Anoche dormiste {h} h: es posible que reacciones más lento. Justamente eso es lo que mide esta prueba.', { h: sueno.valor })}</p>
      )}
      <div className="pvt">
        <button type="button" className={`pvt-blanco ${fase}`} onPointerDown={fase === 'fin' ? undefined : tocar} aria-live="assertive">{texto}</button>
        <div className="pvt-tiempos" aria-label={t('Tiempos de cada intento')}>
          {tiempos.map((t, i) => <span key={i}>{t} ms</span>)}
          {adelantos > 0 && <span>{t('{n} adelanto(s)', { n: adelantos })}</span>}
        </div>
        {fase === 'fin' && <p className="texto-suave">{t('Tu habitual es {base} ms ({signo}{p} %).', { base, signo: media > base ? '+' : '−', p: Math.abs(Math.round(((media - base) / base) * 100)) })}</p>}
      </div>
      <div className="acciones-prueba">
        {fase === 'fin' && (
          <>
            <button className="boton boton-ok" onClick={() => onRegistrar(
              [{ sensor: 'tiempoReaccion', valor: Math.min(1000, Math.max(150, media)), timestamp: Date.now(), fuente: 'sensor' }],
              `Prueba de tiempo de reacción: ${media} milisegundos de promedio, tu habitual es ${base}.`,
            )}><Icono nombre="check" /> {t('Registrar resultado')}</button>
            <button className="boton" onClick={() => { setTiempos([]); setAdelantos(0); setFase('listo'); }}>{t('Repetir')}</button>
          </>
        )}
        <button className="boton boton-fantasma" onClick={onCancelar}>{t('Cancelar')}</button>
      </div>
    </section>
  );
}
