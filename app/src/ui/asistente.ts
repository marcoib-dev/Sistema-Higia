/**
 * ESTADO DEL ASISTENTE — compartido por la sección Higia y el acceso rápido de las demás secciones.
 * Conversación, escucha por palabra clave («Higia») y micrófono manual.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aceptarRespuestaSinNombre,
  detectarLlamado, detener, escucharFrase, escucharPalabraClave, estadoVoz, hablar,
  motivoSinReconocimiento, motorVozPreferido, type EstadoEscucha, type MotorVoz,
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
}

export interface ResultadoConversacion {
  texto: string;
  fuente: 'ia' | 'local';
  hechos: string[];
  nota?: string;
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
  micDisponible: boolean;
  /** Motor elegido: Vosk local, el del navegador o ninguno. */
  motorVoz: MotorVoz;
  /** Aviso persistente: por qué el reconocimiento de voz no puede funcionar (Brave, sin permiso, etc.). */
  problemaVoz?: string;
  enviar: (frase: string, origen?: 'voz' | 'texto') => Promise<void>;
  /** Higia habla por iniciativa propia (p. ej. empieza un chequeo de orientación tras un golpe). */
  decir: (texto: string, hechos?: string[]) => void;
  alternarEscucha: (v: boolean) => void;
  dictar: () => void;
}

export function useAsistente(onFrase: (frase: string) => Promise<ResultadoConversacion>, vozActiva: boolean): Asistente {
  const [historial, setHistorial] = useState<Intercambio[]>([]);
  const [pensando, setPensando] = useState(false);
  const [escuchaActiva, setEscuchaActiva] = useState(leerEscucha);
  const [estadoEscucha, setEstadoEscucha] = useState<EstadoEscucha>('apagada');
  const [detalleEscucha, setDetalleEscucha] = useState<string>();
  const [dictando, setDictando] = useState(false);
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

  const enviar = useCallback(async (frase: string, origen: 'voz' | 'texto' = 'texto') => {
    // "Higia, …" escrito o dictado: el nombre no es parte del pedido.
    const llamado = detectarLlamado(frase);
    const f = (llamado.llamado && llamado.resto ? llamado.resto : frase).trim();
    if (!f || pensandoRef.current) return;
    pensandoRef.current = true;
    setPensando(true);
    try {
      const r = await onFraseRef.current(f);
      setHistorial((prev) => [{ id: Date.now(), pregunta: f, respuesta: r.texto, fuente: r.fuente, hechos: r.hechos, origen, nota: r.nota }, ...prev].slice(0, 40));
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
      onEstado: (e, d) => {
        setEstadoEscucha(e);
        setDetalleEscucha(d);
        if (e === 'error' && d) setProblemaVoz(d);
        if (e === 'esperando' || e === 'llamado') setProblemaVoz(undefined);
      },
      // Mientras Higia habla no se escucha a sí misma.
      ignorar: () => estadoVoz() === 'hablando',
    });
    return parar;
  }, [escuchaActiva, dictando, motorVoz, enviar]);

  const decir = useCallback((texto: string, hechos: string[] = []) => {
    setHistorial((prev) => [{ id: Date.now(), pregunta: '', respuesta: texto, fuente: 'local' as const, hechos, origen: 'voz' as const }, ...prev].slice(0, 40));
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
    setDictando(true);
  };

  return { historial, pensando, escuchaActiva, estadoEscucha, detalleEscucha, dictando, micDisponible, motorVoz, problemaVoz, enviar, decir, alternarEscucha, dictar };
}

export const TEXTO_ESCUCHA: Record<EstadoEscucha, string> = {
  apagada: 'Escucha apagada',
  cargando: 'Preparando voz local…',
  esperando: 'Di «Higia» para hablarle',
  llamado: 'Te escucho…',
  error: 'Escucha no disponible',
};
