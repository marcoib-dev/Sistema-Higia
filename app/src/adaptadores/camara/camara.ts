/**
 * ADAPTADOR DE CÁMARA — captura del entorno para darle contexto a Higia.
 * En el prototipo es la webcam; en el traje sería la cámara del casco o las del hábitat.
 */

export function camaraDisponible(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function iniciarCamara(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } }, audio: false });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function detenerCamara(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Toma un cuadro (de video o de una imagen) y lo devuelve como JPEG en base64, sin el prefijo data:. */
export function capturar(fuente: HTMLVideoElement | HTMLImageElement, anchoMax = 768): string {
  const ancho = fuente instanceof HTMLVideoElement ? fuente.videoWidth : fuente.naturalWidth;
  const alto = fuente instanceof HTMLVideoElement ? fuente.videoHeight : fuente.naturalHeight;
  const escala = Math.min(1, anchoMax / ancho);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  canvas.getContext('2d')!.drawImage(fuente, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
}
