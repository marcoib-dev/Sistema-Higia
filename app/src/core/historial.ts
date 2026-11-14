import type { Lectura, TipoSensor } from './tipos';

/** Límite por sensor: memoria acotada en el dispositivo del traje. */
const MAX_POR_SENSOR = 500;

export class Historial {
  private porSensor = new Map<TipoSensor, Lectura[]>();

  agregar(l: Lectura): void {
    const lista = this.porSensor.get(l.sensor) ?? [];
    lista.push(l);
    lista.sort((a, b) => a.timestamp - b.timestamp);
    if (lista.length > MAX_POR_SENSOR) lista.splice(0, lista.length - MAX_POR_SENSOR);
    this.porSensor.set(l.sensor, lista);
  }

  ultima(s: TipoSensor): Lectura | undefined {
    const l = this.porSensor.get(s);
    return l?.[l.length - 1];
  }

  ultimas(s: TipoSensor, n: number): Lectura[] {
    return (this.porSensor.get(s) ?? []).slice(-n);
  }

  desde(s: TipoSensor, ts: number): Lectura[] {
    return (this.porSensor.get(s) ?? []).filter((l) => l.timestamp >= ts);
  }
}

export function promedio(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
