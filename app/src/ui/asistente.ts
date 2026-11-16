/**
 * ESTADO DEL ASISTENTE — compartido por la sección Higia y el acceso rápido de las demás secciones.
 * Conversación, escucha por palabra clave («Higia») y micrófono manual.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aceptarRespuestaSinNombre,
  detectarLlamado, detener, escucharFrase, escucharPalabraClave, estadoVoz, hablar,
  motivoSinReconocimiento, motorVozPreferido, sonarLlamado, type EstadoEscucha, type MotorVoz,
} from '../adaptadores/voz/voz';

export interface Intercambio {
  id: number;
  pregunta: string;
  respuesta: string;
  fuente: 'ia' | 'local';
  /** Lo que el asistente hizo en la app (pedir ayuda, enviar un mensaje, navegar…). */
  hechos: string[];
  origen: 'voz' | 'texto';
  nota?: string;
  /** Higia habló por iniciativa propia: "Pregunta de Higia", "Evaluación cognitiva 2/6"… */
  etiqueta?: string;
  /** A quién atendía Higia en ese turno: si el simulador cambia de astronauta, el chat lo marca. */
  astronauta?: string;
}

export interface ResultadoConversacion {
  texto: string;
  fuente: 'ia' | 'local';
  hechos: string[];
  nota?: string;
  /** La respuesta es parte de algo que guía Higia (evaluación, chequeo): se muestra con esta etiqueta. */
  etiqueta?: string;
}

const CLAVE_ESCUCHA = 'higia.escucha';
const leerEscucha = () => { try { return localStorage.getItem(CLAVE_ESCUCHA) !== 'apagada'; } catch { return true; } };
const guardarEscucha = (v: boolean) => { try { localStorage.setItem(CLAVE_ESCUCHA, v ? 'activa' : 'apagada'); } catch { /* sin almacenamiento */ } };

export interface Asistente {
  historial: Intercambio[];
  pensando: boolean;
  /** Escucha continua por palabra clave encendida (preferencia del astronauta). */
  escuchaActiva: boolean;
  estadoEscucha: EstadoEscucha;
  detalleEscucha?: string;
  /** Micrófono manual (sin palabra clave) abierto. */
  dictando: boolean;
  /** Lo que se va oyendo después de «Higia», mientras habla (vacío si nada). */
  parcial: string;
  /** Higia está hablando en voz alta en este momento. */
  hablando: boolean;
  /** Estado único para la interfaz: qué está haciendo Higia ahora. */
  actividad: ActividadHigia;
  /** Última vez que el astronauta le habló o escribió (para no interrumpir con preguntas). */
  ultimaInteraccion: number;
  micDisponible: boolean;
  /** Motor elegido: Vosk local, el del navegador o ninguno. */
  motorVoz: MotorVoz;
  /** Aviso persistente: por qué el reconocimiento de voz no puede funcionar (Brave, sin permiso, etc.). */
  problemaVoz?: string;
  enviar: (frase: string, origen?: 'voz' | 'texto') => Promise<void>;
  /** Higia habla por iniciativa propia (p. ej. empieza un chequeo de orientación tras un golpe). */
  decir: (texto: string, hechos?: string[], etiqueta?: string) => void;
  alternarEscucha: (v: boolean) => void;
  dictar: () => void;
}

/** Qué hace Higia ahora: lo que la interfaz muestra con color y animación. */
export type ActividadHigia = 'inactiva' | 'esperando' | 'escuchando' | 'pensando' | 'hablando';

export function useAsistente(onFrase: (frase: string) => Promise<ResultadoConversacion>, vozActiva: boolean, astronauta = ''): Asistente {
  const astronautaRef = useRef(astronauta);
  astronautaRef.current = astronauta;
  const [historial, setHistorial] = useState<Intercambio[]>([]);
  const [pensando, setPensando] = useState(false);
  const [escuchaActiva, setEscuchaActiva] = useState(leerEscucha);
  const [estadoEscucha, setEstadoEscucha] = useState<EstadoEscucha>('apagada');
  const [detalleEscucha, setDetalleEscucha] = useState<string>();
  const [dictando, setDictando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [hablando, setHablando] = useState(false);
  const [ultimaInteraccion, setUltimaInteraccion] = useState(() => Date.now());
  const motorVoz = motorVozPreferido();
  const micDisponible = motorVoz !== 'ninguno';
  // Con Web Speech, Brave y algunos Chromium exponen la API pero nunca devuelven texto:
  // avisar antes de que falle en silencio. Con Vosk local no hace falta ese aviso.
  const [problemaVoz, setProblemaVoz] = useState<string | undefined>(() => (motorVoz === 'navegador' ? motivoSinReconocimiento() : undefined));

  // Referencias a lo último, para los callbacks del reconocedor (que viven más que un render).
  const onFraseRef = useRef(onFrase);
  onFraseRef.current = onFrase;
  const vozRef = useRef(vozActiva);
  vozRef.current = vozActiva;
  const pensandoRef = useRef(false);
  const estadoRef = useRef<EstadoEscucha>('apagada');

  const enviar = useCallback(async (frase: string, origen: 'voz' | 'texto' = 'texto') => {
    // "Higia, …" escrito o dictado: el nombre no es parte del pedido.
    const llamado = detectarLlamado(frase);
    const f = (llamado.llamado && llamado.resto ? llamado.resto : frase).trim();
    if (!f || pensandoRef.current) return;
    setUltimaInteraccion(Date.now());
    pensandoRef.current = true;
    setPensando(true);
    try {
      const r = await onFraseRef.current(f);
      setHistorial((prev) => [{ id: Date.now(), pregunta: f, respuesta: r.texto, fuente: r.fuente, hechos: r.hechos, origen, nota: r.nota, etiqueta: r.etiqueta, astronauta: astronautaRef.current }, ...prev].slice(0, 40));
      if (origen === 'voz') {
        setProblemaVoz(undefined); // el reconocimiento funcionó
        aceptarRespuestaSinNombre(8000); // deja una ventana corta para seguir hablando sin repetir «Higia»
      }
      if (vozRef.current) hablar(r.texto);
    } finally {
      pensandoRef.current = false;
      setPensando(false);
    }
  }, []);

  // Escucha por palabra clave: se apaga mientras se dicta con el micrófono manual.
  useEffect(() => {
    if (!escuchaActiva || dictando) return;
    if (motorVoz === 'ninguno') {
      const motivo = motivoSinReconocimiento() ?? 'Este navegador no tiene reconocimiento de voz (usa Chrome o Edge).';
      setEstadoEscucha('error');
      setDetalleEscucha(motivo);
      setProblemaVoz(motivo);
      return;
    }
    const parar = escucharPalabraClave({
      motor: motorVoz,
      onComando: (t) => { detener(); void enviar(t, 'voz'); },
      onParcial: setParcial,
      onEstado: (e, d) => {
        // Tono de «te escucho» al oír su nombre: confirma sin mirar la pantalla.
        if (e === 'llamado' && estadoRef.current !== 'llamado') sonarLlamado();
        estadoRef.current = e;
        setEstadoEscucha(e);
        if (e !== 'llamado') setParcial('');
        setDetalleEscucha(d);
        if (e === 'error' && d) setProblemaVoz(d);
        if (e === 'esperando' || e === 'llamado') setProblemaVoz(undefined);
      },
      // Mientras Higia habla no se escucha a sí misma.
      ignorar: () => estadoVoz() === 'hablando',
    });
    return parar;
  }, [escuchaActiva, dictando, motorVoz, enviar]);

  // Si Higia está hablando se consulta seguido: la interfaz lo muestra con su propio color.
  useEffect(() => {
    const id = setInterval(() => setHablando(estadoVoz() === 'hablando'), 200);
    return () => clearInterval(id);
  }, []);

  const decir = useCallback((texto: string, hechos: string[] = [], etiqueta?: string) => {
    setHistorial((prev) => [{ id: Date.now() + Math.random(), pregunta: '', respuesta: texto, fuente: 'local' as const, hechos, origen: 'voz' as const, etiqueta, astronauta: astronautaRef.current }, ...prev].slice(0, 40));
    if (vozRef.current) hablar(texto);
  }, []);

  const alternarEscucha = (v: boolean) => {
    guardarEscucha(v);
    setEscuchaActiva(v);
    if (!v) { setEstadoEscucha('apagada'); setDetalleEscucha(undefined); }
  };

  // Micrófono manual: arranca después de que se apague la escucha por palabra clave (un solo reconocedor a la vez).
  useEffect(() => {
    if (!dictando) return;
    let cancelar: (() => void) | undefined;
    // Pequeña espera: el motor nativo de Chrome no permite iniciar un reconocedor mientras el anterior se cierra.
    const arranque = setTimeout(() => {
      cancelar = escucharFrase(
        (t) => void enviar(t, 'voz'),
        () => setDictando(false),
        (m) => { setProblemaVoz(m); setDetalleEscucha(m); },
        motorVoz,
      );
    }, 150);
    return () => { clearTimeout(arranque); cancelar?.(); };
  }, [dictando, enviar, motorVoz]);

  /** Micrófono manual: una frase, sin necesidad de decir «Higia». */
  const dictar = () => {
    detener(); // hablarle a Higia la interrumpe
    sonarLlamado();
    setUltimaInteraccion(Date.now());
    setDictando(true);
  };

  const actividad: ActividadHigia = estadoEscucha === 'llamado' || dictando ? 'escuchando'
    : pensando ? 'pensando'
    : hablando ? 'hablando'
    : estadoEscucha === 'esperando' ? 'esperando' : 'inactiva';

  return {
    historial, pensando, escuchaActiva, estadoEscucha, detalleEscucha, dictando, parcial, hablando, actividad, ultimaInteraccion,
    micDisponible, motorVoz, problemaVoz, enviar, decir, alternarEscucha, dictar,
  };
}

export const TEXTO_ACTIVIDAD: Record<ActividadHigia, string> = {
  inactiva: 'Higia en espera',
  esperando: 'Di «Higia» para hablarle',
  escuchando: 'Te escucho…',
  pensando: 'Pensando…',
  hablando: 'Higia está hablando',
};

export const TEXTO_ESCUCHA: Record<EstadoEscucha, string> = {
  apagada: 'Escucha apagada',
  cargando: 'Preparando voz local…',
  esperando: 'Di «Higia» para hablarle',
  llamado: 'Te escucho…',
  error: 'Escucha no disponible',
};
