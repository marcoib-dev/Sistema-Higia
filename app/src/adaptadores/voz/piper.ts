/**
 * VOZ NEURONAL LOCAL (Piper) — Higia habla con una voz natural, generada en el dispositivo y sin
 * conexión. El modelo, el fonemizador y el motor ONNX salen de public/voz/piper/ si están
 * (`npm run voz:piper`, en desarrollo); si no (Vercel no los tiene: pesan ~85 MB y no van a git),
 * se bajan de Hugging Face y jsDelivr. La voz queda guardada en el navegador (OPFS): solo la primera
 * visita la descarga, en segundo plano. Si algo falta o falla, `voz.ts` sigue con la voz del
 * navegador: hablar nunca depende de esto.
 */

export const VOZ_PIPER = ((import.meta.env.VITE_PIPER_VOZ as string | undefined)?.trim()) || 'es_MX-claude-high';
const BASE = `${import.meta.env.BASE_URL}voz/piper/`;
/** VITE_PIPER_ORIGEN=remoto ignora los archivos locales (para probar como en Vercel). */
const FORZAR_REMOTO = import.meta.env.VITE_PIPER_ORIGEN === 'remoto';

/** Dónde está cada archivo cuando no se sirve desde public/voz/piper/. */
const [REGION = '', NOMBRE = '', CALIDAD = ''] = VOZ_PIPER.split('-');
const REMOTO = {
  // es_MX-claude-high → es/es_MX/claude/high/
  voz: `https://huggingface.co/diffusionstudio/piper-voices/resolve/main/${REGION.split('_')[0]}/${REGION}/${NOMBRE}/${CALIDAD}/`,
  fonemizador: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/',
  // La misma versión del motor ONNX que trae el bundle: si no coinciden, el .wasm no carga.
  ort: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${__ORT_VERSION__}/dist/`,
};

/** ¿El servidor tiene los archivos de la voz? (Si no, Vercel responde la página en lugar del .json.) */
async function hayArchivosLocales(): Promise<boolean> {
  if (FORZAR_REMOTO) return false;
  try {
    const r = await fetch(`${BASE}${VOZ_PIPER}.onnx.json`, { method: 'HEAD' });
    return r.ok && !(r.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}
/** VITE_PIPER=0 desactiva la voz neuronal (queda la del navegador). */
const DESACTIVADA = import.meta.env.VITE_PIPER === '0';

type EstadoPiper = 'inactiva' | 'cargando' | 'lista' | 'error';
let estado: EstadoPiper = 'inactiva';
let motivo = '';
let sesion: { predict: (texto: string) => Promise<Blob> } | null = null;

export const estadoPiper = () => estado;
export const motivoPiper = () => motivo;

/**
 * La librería busca primero la voz en el almacenamiento del navegador (carpeta "piper", por nombre
 * de archivo) y solo si no está la pide a internet. Se la dejamos ahí desde los archivos locales.
 */
async function sembrar(archivo: string, base: string): Promise<void> {
  const raiz = await navigator.storage.getDirectory();
  const dir = await raiz.getDirectoryHandle('piper', { create: true });
  try {
    const f = await (await dir.getFileHandle(archivo)).getFile();
    if (f.size > 0) return;
  } catch { /* no está todavía */ }
  const r = await fetch(`${base}${archivo}`);
  if (!r.ok) throw new Error(`no se pudo bajar ${archivo} (HTTP ${r.status})`);
  const escritor = await (await dir.getFileHandle(archivo, { create: true })).createWritable();
  await escritor.write(await r.blob());
  await escritor.close();
}

let carga: Promise<boolean> | null = null;

/** Prepara la voz una sola vez. Devuelve true si quedó lista. Nunca lanza. */
export function prepararPiper(): Promise<boolean> {
  if (DESACTIVADA || typeof window === 'undefined' || !navigator.storage?.getDirectory) {
    estado = 'error';
    motivo = DESACTIVADA ? 'desactivada (VITE_PIPER=0)' : 'el navegador no permite guardar la voz';
    return Promise.resolve(false);
  }
  carga ??= (async () => {
    estado = 'cargando';
    try {
      const local = await hayArchivosLocales();
      const base = local ? BASE : REMOTO.voz;
      // El .json primero: si falta, se avisa enseguida sin bajar nada grande.
      await sembrar(`${VOZ_PIPER}.onnx.json`, base);
      await sembrar(`${VOZ_PIPER}.onnx`, base);
      const { TtsSession } = await import('@mintplex-labs/piper-tts-web');
      sesion = await TtsSession.create({
        voiceId: VOZ_PIPER,
        wasmPaths: {
          // El motor ONNX que usa la librería ya trae su JS adentro: solo hay que indicarle dónde está el .wasm.
          onnxWasm: { wasm: `${local ? `${BASE}ort/` : REMOTO.ort}ort-wasm-simd-threaded.wasm` } as unknown as string,
          piperData: `${local ? BASE : REMOTO.fonemizador}piper_phonemize.data`,
          piperWasm: `${local ? BASE : REMOTO.fonemizador}piper_phonemize.wasm`,
        },
      });
      // Primera inferencia de calentamiento: la que sigue ya sale rápida.
      await sesion.predict('Hola.');
      estado = 'lista';
      return true;
    } catch (e) {
      estado = 'error';
      motivo = e instanceof Error ? e.message : String(e);
      console.warn(`Voz neuronal no disponible (${motivo}). Se usa la voz del navegador.`);
      return false;
    }
  })();
  return carga;
}

/** Genera el audio de un texto (WAV). Solo con la voz lista. */
export async function sintetizar(texto: string): Promise<Blob> {
  if (!sesion || estado !== 'lista') throw new Error('La voz neuronal no está lista.');
  return sesion.predict(texto);
}
