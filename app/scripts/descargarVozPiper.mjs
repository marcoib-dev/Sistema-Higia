/**
 * Descarga la voz neuronal de Piper (español) y los motores que necesita, para que Higia hable
 * con una voz natural SIN conexión. Todo queda en public/voz/piper/ y no se sube a git.
 *
 *   npm run voz:piper                      # voz por defecto (es_MX-claude-high)
 *   npm run voz:piper -- es_ES-davefx-medium
 *   npm run voz:piper -- --forzar
 *
 * Si eliges otra voz, ponla también en app/.env.local: VITE_PIPER_VOZ=es_ES-davefx-medium
 */
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VOZ = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'es_MX-claude-high';
const FORZAR = process.argv.includes('--forzar');
const DESTINO = path.resolve('public/voz/piper');
const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';
const PHONEMIZE = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';

// es_MX-claude-high → es/es_MX/claude/high/es_MX-claude-high.onnx
const [region, nombre, calidad] = VOZ.split('-');
if (!region || !nombre || !calidad) throw new Error(`Voz inválida: "${VOZ}". Ejemplo: es_MX-claude-high`);
const rutaModelo = `${region.split('_')[0]}/${region}/${nombre}/${calidad}/${VOZ}.onnx`;

const existe = (f, minimo = 1) => stat(f).then((s) => s.size >= minimo).catch(() => false);

async function bajar(url, archivo, minimo = 1) {
  if (!FORZAR && (await existe(archivo, minimo))) {
    console.log(`  ya está: ${path.basename(archivo)}`);
    return;
  }
  process.stdout.write(`  descargando ${path.basename(archivo)}… `);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar ${url}: HTTP ${r.status}`);
  const datos = Buffer.from(await r.arrayBuffer());
  await writeFile(archivo, datos);
  console.log(`${(datos.length / 1024 / 1024).toFixed(1)} MB`);
}

await mkdir(path.join(DESTINO, 'ort'), { recursive: true });

console.log(`Voz ${VOZ}:`);
await bajar(`${HF}/${rutaModelo}`, path.join(DESTINO, `${VOZ}.onnx`), 1024 * 1024);
await bajar(`${HF}/${rutaModelo}.json`, path.join(DESTINO, `${VOZ}.onnx.json`));

console.log('Fonemizador (espeak-ng):');
await bajar(`${PHONEMIZE}.wasm`, path.join(DESTINO, 'piper_phonemize.wasm'));
await bajar(`${PHONEMIZE}.data`, path.join(DESTINO, 'piper_phonemize.data'));

// El motor ONNX se copia de node_modules: así coincide siempre con la versión instalada.
console.log('Motor ONNX (desde node_modules):');
const ort = path.resolve('node_modules/onnxruntime-web/dist');
for (const f of await readdir(ort)) {
  if (/^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(f)) await copyFile(path.join(ort, f), path.join(DESTINO, 'ort', f));
}
console.log(`Listo: ${path.relative(process.cwd(), DESTINO)}`);
