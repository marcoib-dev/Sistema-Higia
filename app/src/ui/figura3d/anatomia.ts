/**
 * ANATOMÍA PROCEDURAL — cuerpo humano en pose "A", generado por código (sin modelos externos ni licencias).
 * Cada parte es un tubo que sigue un "hueso" (curva) con un perfil de sección elíptica variable
 * (ancho, profundidad y desplazamiento hacia adelante). Unidades ≈ metros; altura ≈ 1,83.
 */
import * as THREE from 'three';
import type { SistemaCorporal } from '../../core/tipos';

/** [radio lateral, radio de profundidad, desplazamiento hacia adelante] a lo largo del segmento. */
type Perfil = [number, number, number?][];

export interface Segmento {
  puntos: [number, number, number][];
  perfil: Perfil;
  /** Eje de referencia para orientar la sección: 'z' (por defecto) o 'y' para piezas horizontales como los pies. */
  ejeRef?: 'z' | 'y';
  anillos?: number;
  lados?: number;
}

/** Interpolación Catmull-Rom 1D sobre valores equiespaciados: perfiles suaves sin quiebres. */
function catmull(v: number[], t: number): number {
  const n = v.length - 1;
  const x = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const f = x - i;
  const p0 = v[Math.max(i - 1, 0)], p1 = v[i], p2 = v[i + 1], p3 = v[Math.min(i + 2, n)];
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

/** Genera la superficie (triángulos) y la malla de cuadros (líneas) de un segmento. */
export function construirSegmento(s: Segmento): { superficie: THREE.BufferGeometry; malla: THREE.BufferGeometry } {
  const anillos = s.anillos ?? 24;
  const lados = s.lados ?? 20;
  const curva = new THREE.CatmullRomCurve3(s.puntos.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const ref = s.ejeRef === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const rx = s.perfil.map((p) => p[0]);
  const rz = s.perfil.map((p) => p[1]);
  const dz = s.perfil.map((p) => p[2] ?? 0);

  const pos: number[] = [];
  const lat = new THREE.Vector3();
  const prof = new THREE.Vector3();
  const centros: THREE.Vector3[] = [];

  for (let i = 0; i <= anillos; i++) {
    const t = i / anillos;
    const c = curva.getPointAt(t);
    const T = curva.getTangentAt(t);
    lat.crossVectors(T, ref).normalize();   // eje lateral de la sección
    prof.crossVectors(lat, T).normalize();  // eje de profundidad (hacia adelante)
    const a = catmull(rx, t), b = catmull(rz, t), d = catmull(dz, t);
    for (let j = 0; j < lados; j++) {
      const ang = (j / lados) * Math.PI * 2;
      const p = c.clone().addScaledVector(lat, a * Math.cos(ang)).addScaledVector(prof, b * Math.sin(ang) + d);
      pos.push(p.x, p.y, p.z);
    }
    if (i === 0 || i === anillos) centros.push(c.clone().addScaledVector(prof, d));
  }
  const iInicio = pos.length / 3;
  pos.push(centros[0].x, centros[0].y, centros[0].z);
  const iFin = iInicio + 1;
  pos.push(centros[1].x, centros[1].y, centros[1].z);

  const v = (i: number, j: number) => i * lados + (j % lados);
  const tri: number[] = [];
  for (let i = 0; i < anillos; i++) {
    for (let j = 0; j < lados; j++) {
      tri.push(v(i, j), v(i + 1, j), v(i, j + 1));
      tri.push(v(i + 1, j), v(i + 1, j + 1), v(i, j + 1));
    }
  }
  for (let j = 0; j < lados; j++) {
    tri.push(iInicio, v(0, j), v(0, j + 1));             // tapa inicial (mira hacia atrás)
    tri.push(iFin, v(anillos, j + 1), v(anillos, j));    // tapa final (mira hacia adelante)
  }

  const lin: number[] = [];
  for (let i = 0; i <= anillos; i++) for (let j = 0; j < lados; j++) lin.push(v(i, j), v(i, j + 1));
  for (let i = 0; i < anillos; i++) for (let j = 0; j < lados; j++) lin.push(v(i, j), v(i + 1, j));

  const atributo = new THREE.Float32BufferAttribute(pos, 3);
  const superficie = new THREE.BufferGeometry();
  superficie.setAttribute('position', atributo);
  superficie.setIndex(tri);
  superficie.computeVertexNormals();
  const malla = new THREE.BufferGeometry();
  malla.setAttribute('position', atributo);
  malla.setIndex(lin);
  return { superficie, malla };
}

// ── Piezas del cuerpo ──────────────────────────────────────────────────

const TORSO: Segmento = {
  puntos: [[0, 0.8, 0], [0, 1.1, 0], [0, 1.3, 0.005], [0, 1.5, -0.01]],
  perfil: [
    [0.05, 0.045], [0.135, 0.09, -0.005], [0.163, 0.104, -0.012], [0.162, 0.104, -0.006], [0.147, 0.097], [0.14, 0.095, 0.005],
    [0.148, 0.1, 0.008], [0.16, 0.108, 0.01], [0.17, 0.112, 0.012], [0.176, 0.105, 0.005], [0.165, 0.085, -0.01], [0.07, 0.06, -0.01],
  ],
  anillos: 32, lados: 24,
};

const CUELLO: Segmento = {
  puntos: [[0, 1.45, -0.01], [0, 1.54, -0.005], [0, 1.62, 0]],
  perfil: [[0.065, 0.06], [0.056, 0.055], [0.055, 0.058, 0.005]],
  anillos: 8, lados: 16,
};

const CABEZA: Segmento = {
  puntos: [[0, 1.555, 0.01], [0, 1.69, 0], [0, 1.83, -0.01]],
  perfil: [
    [0.02, 0.02, 0.035], [0.05, 0.055, 0.025], [0.066, 0.075, 0.016], [0.074, 0.088, 0.01], [0.079, 0.096, 0.006], [0.083, 0.101, 0.003],
    [0.086, 0.104, 0], [0.087, 0.104, -0.004], [0.085, 0.1, -0.007], [0.077, 0.09, -0.01], [0.058, 0.068, -0.011], [0.012, 0.014, -0.012],
  ],
  anillos: 22, lados: 20,
};

const NARIZ: Segmento = {
  puntos: [[0, 1.705, 0.092], [0, 1.672, 0.116]],
  perfil: [[0.01, 0.006], [0.016, 0.012], [0.004, 0.004]],
  anillos: 5, lados: 10,
};

/** Brazo en pose "A" (≈50° bajo la horizontal). s = 1 derecha, -1 izquierda. */
const brazo = (s: number): Segmento => ({
  puntos: [[s * 0.15, 1.43, -0.01], [s * 0.21, 1.4, -0.015], [s * 0.383, 1.19, -0.02], [s * 0.557, 0.983, -0.01]],
  perfil: [
    [0.06, 0.055], [0.064, 0.06], [0.056, 0.053], [0.048, 0.046, 0.005], [0.042, 0.04],
    [0.036, 0.036], [0.04, 0.037], [0.036, 0.032], [0.03, 0.026], [0.025, 0.019],
  ],
  anillos: 26, lados: 16,
});

/** Mano tipo "manopla", palma hacia el cuerpo. */
const mano = (s: number): Segmento => ({
  puntos: [[s * 0.55, 0.99, -0.01], [s * 0.6, 0.93, -0.005], [s * 0.66, 0.855, 0.0]],
  perfil: [[0.018, 0.026], [0.015, 0.04], [0.014, 0.044], [0.012, 0.04], [0.008, 0.028], [0.003, 0.01]],
  anillos: 10, lados: 12,
});

const pierna = (s: number): Segmento => ({
  puntos: [[s * 0.085, 0.93, 0], [s * 0.095, 0.5, 0.01], [s * 0.1, 0.07, -0.015]],
  perfil: [
    [0.085, 0.092], [0.088, 0.092, 0.005], [0.078, 0.082, 0.006], [0.066, 0.068, 0.004], [0.055, 0.058],
    [0.052, 0.055, 0.004], [0.055, 0.06, -0.008], [0.056, 0.063, -0.012], [0.046, 0.05, -0.006], [0.036, 0.04], [0.032, 0.034],
  ],
  anillos: 30, lados: 18,
});

const pie = (s: number): Segmento => ({
  puntos: [[s * 0.1, 0.05, -0.055], [s * 0.105, 0.04, 0.05], [s * 0.11, 0.02, 0.15]],
  perfil: [[0.03, 0.03], [0.038, 0.038], [0.044, 0.032], [0.047, 0.024], [0.042, 0.015], [0.018, 0.008]],
  ejeRef: 'y', anillos: 12, lados: 14,
});

export interface ParteCuerpo {
  id: string;
  /** Sistemas que tiñen esta zona de la piel. Vacío = piel neutra (el color lo dan los órganos de adentro). */
  sistemas: SistemaCorporal[];
  segmentos: Segmento[];
}

export const PIEL: ParteCuerpo[] = [
  { id: 'piel-cabeza', sistemas: [], segmentos: [CABEZA, CUELLO, NARIZ] },
  { id: 'torso', sistemas: ['inmune'], segmentos: [TORSO] },
  { id: 'brazos', sistemas: ['musculos'], segmentos: [brazo(1), mano(1), brazo(-1), mano(-1)] },
  { id: 'piernas', sistemas: ['piernas'], segmentos: [pierna(1), pie(1), pierna(-1), pie(-1)] },
];

// ── Órganos internos (opacos, se ven a través de la piel) ──────────────

export interface Organo {
  id: string;
  sistemas: SistemaCorporal[];
  crear: () => THREE.Mesh[];
}

const elipsoide = (r: number, [x, y, z]: [number, number, number], [sx, sy, sz]: [number, number, number] = [1, 1, 1]) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
};

export const ORGANOS: Organo[] = [
  { id: 'cerebro', sistemas: ['cerebro'], crear: () => [elipsoide(0.066, [0, 1.735, -0.008], [1, 0.82, 1.18])] },
  { id: 'ojos', sistemas: ['ojos'], crear: () => [elipsoide(0.013, [-0.032, 1.708, 0.088]), elipsoide(0.013, [0.032, 1.708, 0.088])] },
  {
    id: 'oidos', sistemas: ['oidoInterno'],
    crear: () => [elipsoide(0.03, [-0.084, 1.69, -0.005], [0.35, 1, 0.7]), elipsoide(0.03, [0.084, 1.69, -0.005], [0.35, 1, 0.7])],
  },
  { id: 'pulmones', sistemas: ['pulmones'], crear: () => [elipsoide(0.058, [-0.075, 1.3, 0], [1, 1.9, 1.15]), elipsoide(0.058, [0.075, 1.3, 0], [1, 1.9, 1.15])] },
  { id: 'corazon', sistemas: ['corazon'], crear: () => [elipsoide(0.04, [0.025, 1.265, 0.048], [1, 1.15, 0.9])] },
  { id: 'abdomen', sistemas: ['metabolismo', 'intestino'], crear: () => [elipsoide(0.1, [0, 1.07, 0.02], [1.1, 0.75, 0.72])] },
  {
    id: 'columna', sistemas: ['huesos'],
    crear: () => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.62, 8, 16));
      m.position.set(0, 1.22, -0.068);
      return [m];
    },
  },
];
