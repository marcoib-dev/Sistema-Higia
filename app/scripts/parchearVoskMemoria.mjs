import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmPath = path.join(raiz, 'node_modules/@lichess-org/vosk-browser/dist/vosk.wasm');
const workerPath = path.join(raiz, 'node_modules/@lichess-org/vosk-browser/dist/vosk.worker.js');

async function parchearWasm() {
  const buffer = await readFile(wasmPath);
  let posicion = 8;
  const leerUleb = () => {
    let valor = 0;
    let desplazamiento = 0;
    let byte;
    do {
      byte = buffer[posicion++];
      valor |= (byte & 0x7f) << desplazamiento;
      desplazamiento += 7;
    } while (byte & 0x80);
    return valor;
  };
  while (posicion < buffer.length) {
    const tipo = buffer[posicion++];
    const longitud = leerUleb();
    const fin = posicion + longitud;
    if (tipo === 5) {
      const cantidad = leerUleb();
      if (cantidad !== 1) return false;
      const flags = leerUleb();
      const minimo = leerUleb();
      if (flags !== 1 || minimo !== 264) return false;
      const original = Buffer.from([0x80, 0x80, 0x02]); // 32,768 páginas = 2 GiB
      const ampliado = Buffer.from([0x80, 0x80, 0x04]); // 65,536 páginas = 4 GiB
      const posicionMaximo = buffer.indexOf(original, posicion);
      if (posicionMaximo < 0 || posicionMaximo >= fin) return false;
      ampliado.copy(buffer, posicionMaximo);
      await writeFile(wasmPath, buffer);
      return true;
    }
    posicion = fin;
  }
  return false;
}

async function parchearWorker() {
  const contenido = await readFile(workerPath, 'utf8');
  const original = 'var getHeapMax = () => 2147483648;';
  if (!contenido.includes(original)) return false;
  await writeFile(workerPath, contenido.replace(original, 'var getHeapMax = () => 4294967296;'));
  return true;
}

try {
  const wasm = await parchearWasm();
  const worker = await parchearWorker();
  if (wasm || worker) console.log('Vosk WASM configurado con hasta 4 GiB de memoria.');
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.log('Vosk aún no está instalado; se aplicará el parche en la próxima instalación.');
  } else {
    throw error;
  }
}
