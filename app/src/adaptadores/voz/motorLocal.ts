/**
 * MOTOR DE VOZ LOCAL — Vosk compilado a WebAssembly.
 *
 * Funciona en el dispositivo y sin conexión (el modelo se descarga una vez y queda en IndexedDB).
 * Es el motor que necesitan Brave, Firefox y Chromium sin los servicios de Google, y el que
 * permite que el reconocimiento sea realmente autónomo. La síntesis de voz sigue siendo la del sistema.
 */
import { VoskClient, type KaldiRecognizer } from '@lichess-org/vosk-browser';
import urlTrabajador from '@lichess-org/vosk-browser/dist/vosk.worker.js?url';
import urlWasm from '@lichess-org/vosk-browser/dist/vosk.wasm?url';

/** El modelo español se genera con `npm run voz:modelo`. */
export const MODELO_POR_DEFECTO = `${import.meta.env.BASE_URL}voz/vosk-model-es-0.42.tar.gz?v=4gb`;

/** Vosk trabaja con el modelo de 16 kHz: hay que capturar a esa frecuencia. */
const FRECUENCIA = 16000;

export function urlModeloVoz(): string {
  const configurado = import.meta.env.VITE_VOSK_MODELO as string | undefined;
  return configurado?.trim() || MODELO_POR_DEFECTO;
}

/** ¿El navegador puede ejecutar el motor local? (WASM + micrófono + contexto seguro). */
export function voskSoportado(): boolean {
  return typeof window !== 'undefined'
    && typeof AudioContext !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && window.isSecureContext !== false;
}

let clientePromesa: Promise<VoskClient> | undefined;

/**
 * Carga el modelo una sola vez por sesión. El worker lo guarda en IndexedDB, así que las
 * siguientes cargas no vuelven a descargar ni extraer el archivo.
 */
function cargarCliente(): Promise<VoskClient> {
  if (clientePromesa) return clientePromesa;
  clientePromesa = new Promise<VoskClient>((resolver, rechazar) => {
    const cliente = new VoskClient({
      modelUrl: urlModeloVoz(),
      workerUrl: urlTrabajador,
      wasmUrl: urlWasm,
      logLevel: 0,
    });
    let terminado = false;
    const espera = setTimeout(() => {
      if (terminado) return;
      terminado = true;
      cliente.terminate();
      rechazar(new Error('El modelo de voz local tardó demasiado en cargar. Revisa que exista en ' + urlModeloVoz()));
    }, 180_000);
    cliente.on('load', (m) => {
      const carga = m as { result?: boolean };
      if (terminado || !carga.result) return;
      terminado = true;
      clearTimeout(espera);
      resolver(cliente);
    });
    cliente.on('error', (m) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(espera);
      cliente.terminate();
      rechazar(new Error((m as { error?: string }).error || 'No se pudo cargar el modelo de voz local.'));
    });
  }).catch((e) => {
    clientePromesa = undefined; // permite reintentar (p. ej. tras descargar el modelo)
    throw e;
  });
  return clientePromesa;
}

export interface OpcionesEscuchaLocal {
  /** Frase final reconocida. Vosk entrega el texto cuando detecta una pausa. */
  onTexto: (texto: string) => void;
  /** El micrófono y el modelo ya están funcionando. */
  onListo?: () => void;
  /** Aviso no fatal (por ejemplo, el audio está a la espera de un gesto del usuario). */
  onAviso?: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}

function mensajeDeError(e: unknown): string {
  const nombre = (e as { name?: string } | undefined)?.name;
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'Permiso de micrófono denegado: permite el micrófono en el candado de la barra de direcciones y vuelve a intentarlo.';
  }
  if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError') return 'No se encontró un micrófono. Conecta uno y vuelve a intentarlo.';
  if (nombre === 'NotReadableError' || nombre === 'TrackStartError') return 'El micrófono está en uso por otra aplicación. Ciérrala y vuelve a intentarlo.';
  const mensaje = e instanceof Error ? e.message : '';
  if (/aborted\(\)|out of memory|memory growth|cannot enlarge memory/i.test(mensaje)) {
    return 'El modelo Vosk grande no cabe en la memoria WebAssembly disponible del navegador. Usa un navegador con más memoria o ejecuta el reconocimiento Vosk fuera del navegador; el modelo configurado sigue siendo el grande.';
  }
  if (/404|fetch|download|failed to load|no such file/i.test(mensaje)) {
    return `No se pudo cargar el modelo de voz local (${mensaje || urlModeloVoz()}). Ejecuta "npm run voz:modelo" en la carpeta app/.`;
  }
  if (mensaje) return mensaje;
  return 'No se pudo iniciar el reconocimiento de voz local.';
}

/**
 * Abre el micrófono y transcribe en continuo con Vosk. Devuelve una función para detener.
 * La inicialización es asíncrona: si se detiene antes de terminar, no queda nada abierto.
 */
export function crearEscuchaLocal({ onTexto, onListo, onAviso, onError }: OpcionesEscuchaLocal): () => void {
  let parado = false;
  let detener: (() => void) | undefined;

  const cerrar = () => {
    parado = true;
    detener?.();
  };

  void (async () => {
    let stream: MediaStream | undefined;
    let contexto: AudioContext | undefined;
    let fuente: MediaStreamAudioSourceNode | undefined;
    let nodo: ScriptProcessorNode | undefined;
    let silencio: GainNode | undefined;
    let reconocedor: KaldiRecognizer | undefined;
    let anunciado = false;
    let aviso: ReturnType<typeof setTimeout> | undefined;

    const reanudarConGesto = () => {
      void contexto?.resume().catch(() => { /* sin audio */ });
    };
    const quitarGesto = () => {
      document.removeEventListener('pointerdown', reanudarConGesto);
      document.removeEventListener('keydown', reanudarConGesto);
    };
    const listo = () => {
      if (parado || anunciado) return;
      anunciado = true;
      clearTimeout(aviso);
      quitarGesto();
      onListo?.();
    };
    const limpiar = () => {
      quitarGesto();
      clearTimeout(aviso);
      if (contexto) contexto.onstatechange = null;
      try { nodo?.disconnect(); } catch { /* ya desconectado */ }
      try { fuente?.disconnect(); } catch { /* ya desconectado */ }
      try { silencio?.disconnect(); } catch { /* ya desconectado */ }
      try { reconocedor?.remove(); } catch { /* ya eliminado */ }
      stream?.getTracks().forEach((t) => t.stop());
      if (contexto && contexto.state !== 'closed') void contexto.close().catch(() => { /* ya cerrado */ });
    };
    detener = limpiar;

    try {
      if (!voskSoportado()) {
        throw new Error('Este navegador no puede ejecutar la voz local: hacen falta micrófono y un contexto seguro (localhost o HTTPS).');
      }
      const [cliente, microfono] = await Promise.all([
        cargarCliente(),
        navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        }),
      ]);
      stream = microfono;
      if (parado) { limpiar(); return; }

      contexto = new AudioContext({ sampleRate: FRECUENCIA });
      if (contexto.sampleRate !== FRECUENCIA) {
        throw new Error(`El navegador no puede capturar a ${FRECUENCIA} Hz (usa ${contexto.sampleRate} Hz), que es lo que necesita el modelo local. Prueba con Google Chrome o Microsoft Edge.`);
      }

      reconocedor = new cliente.KaldiRecognizer(FRECUENCIA);
      reconocedor.on('result', (m) => {
        if (parado) return;
        const texto = ((m as { result?: { text?: string } }).result?.text ?? '').trim();
        if (texto) onTexto(texto);
      });
      reconocedor.on('error', (m) => {
        if (!parado) onError((m as { error?: string }).error || 'El reconocimiento local falló.');
      });

      fuente = contexto.createMediaStreamSource(stream);
      nodo = contexto.createScriptProcessor(4096, 1, 1);
      nodo.onaudioprocess = (evento) => {
        if (parado || !reconocedor) return;
        try {
          reconocedor.acceptWaveform(evento.inputBuffer);
        } catch {
          /* un bloque perdido no debe cortar la escucha */
        }
      };
      // ScriptProcessor necesita un destino para que el navegador lo ejecute; el gain 0 evita eco.
      silencio = contexto.createGain();
      silencio.gain.value = 0;
      fuente.connect(nodo);
      nodo.connect(silencio);
      silencio.connect(contexto.destination);

      // El audio puede crearse suspendido si no hubo un gesto del usuario: esperar a que corra.
      contexto.onstatechange = () => { if (contexto?.state === 'running') listo(); };
      if (contexto.state === 'running') {
        listo();
      } else {
        document.addEventListener('pointerdown', reanudarConGesto);
        document.addEventListener('keydown', reanudarConGesto);
        void contexto.resume().catch(() => { /* se reintenta con el gesto */ });
        aviso = setTimeout(() => {
          if (!parado && !anunciado) onAviso?.('Toca la pantalla una vez para activar el micrófono.');
        }, 1200);
      }

      if (parado) { limpiar(); return; }
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        if (!parado) onError('El micrófono se desconectó. Vuelve a activar la escucha.');
      });
    } catch (e) {
      limpiar();
      if (!parado) onError(mensajeDeError(e));
    }
  })();

  return cerrar;
}

/** Una sola frase para el botón del micrófono: termina en cuanto Vosk entrega un resultado. */
export function escucharFraseLocal(
  onTexto: (texto: string) => void,
  onFin: () => void,
  onError?: (mensaje: string) => void,
): () => void {
  let terminado = false;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let detener: (() => void) | undefined;

  const acabar = (texto?: string, error?: string) => {
    if (terminado) return;
    terminado = true;
    clearTimeout(temporizador);
    detener?.();
    if (texto) onTexto(texto);
    if (error) onError?.(error);
    onFin();
  };

  detener = crearEscuchaLocal({
    onListo: () => {
      temporizador = setTimeout(() => acabar(undefined, 'No se escuchó ninguna frase. Inténtalo de nuevo.'), 15_000);
    },
    onTexto: (t) => acabar(t),
    onError: (m) => acabar(undefined, m),
  });

  return () => acabar();
}
