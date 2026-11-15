/**
 * Descarga el modelo español pequeño de Vosk y lo empaqueta como tar.gz, que es el formato
 * que espera vosk-browser. El archivo queda en public/voz/ y no se sube a git.
 *
 *   npm run voz:modelo            # descarga si falta
 *   npm run voz:modelo -- --forzar
 */
import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MODELO = 'vosk-model-es-0.42';
const URL_MODELO = `https://alphacephei.com/vosk/models/${MODELO}.zip`;
const DESTINO = path.resolve('public/voz', `${MODELO}.tar.gz`);
const FORZAR = process.argv.includes('--forzar');

/**
 * Descomprime el .zip sin depender de `unzip`, que no viene en Windows.
 * `tar` de Windows y de macOS (bsdtar) lee zip; en Linux se usa `unzip` y, si falta, `unzip -q`.
 */
function extraerZip(zip, destino) {
  const conUnzip = () => execFileSync('unzip', ['-q', zip, '-d', destino], { stdio: 'ignore' });
  const conTar = () => execFileSync('tar', ['-xf', zip, '-C', destino], { stdio: 'ignore' });
  const intentos = process.platform === 'linux' ? [conUnzip, conTar] : [conTar, conUnzip];
  let ultimoError;
  for (const intento of intentos) {
    try {
      intento();
      return;
    } catch (e) {
      ultimoError = e;
    }
  }
  throw new Error(
    `No se pudo descomprimir ${zip}. Instala "unzip" o descomprime el archivo a mano. (${ultimoError?.message})`,
  );
}

const existe = await stat(DESTINO).then((s) => s.size > 30 * 1024 * 1024).catch(() => false);
if (existe && !FORZAR) {
  console.log(`Ya existe ${path.relative(process.cwd(), DESTINO)} (usa --forzar para volver a descargarlo).`);
  process.exit(0);
}

const temporal = await mkdtemp(path.join(tmpdir(), 'vosk-'));
const zip = path.join(temporal, `${MODELO}.zip`);
try {
  console.log(`Descargando ${URL_MODELO} …`);
  const respuesta = await fetch(URL_MODELO);
  if (!respuesta.ok || !respuesta.body) throw new Error(`No se pudo descargar el modelo: HTTP ${respuesta.status}`);
  await pipeline(Readable.fromWeb(respuesta.body), createWriteStream(zip));

  console.log('Descomprimiendo…');
  extraerZip(zip, temporal);

  await mkdir(path.dirname(DESTINO), { recursive: true });
  console.log('Empaquetando como tar.gz…');
  // Ruta relativa al archivo: el tar de GNU (el de Git para Windows) toma "D:" como un servidor remoto.
  execFileSync('tar', ['-czf', path.basename(DESTINO), '-C', temporal, MODELO], { cwd: path.dirname(DESTINO) });

  const { size } = await stat(DESTINO);
  console.log(`Listo: ${path.relative(process.cwd(), DESTINO)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
} finally {
  await rm(temporal, { recursive: true, force: true });
}
