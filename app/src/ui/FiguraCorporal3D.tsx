/**
 * FIGURA 3D — modo pasivo. Cuerpo translúcido con órganos coloreados por estado.
 * Arrastra para rotar, rueda para acercar, clic para ver el detalle de una región.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { NOMBRE_SISTEMA, type EstadoCorporal, type Nivel, type SistemaCorporal } from '../core/tipos';
import { COLOR_NIVEL, NOMBRE_NIVEL, peorEstado } from './FiguraCorporal';

type EstadoVisual = Nivel | 'sinDatos';

/** Mismos colores que los tokens CSS; three.js necesita valores concretos. */
const HEX: Record<EstadoVisual, number> = {
  normal: 0x3fbf7f, info: 0x4f9cf0, aviso: 0xf0b13c, alerta: 0xef5350, sinDatos: 0x5a6488,
};

interface Region {
  id: string;
  sistemas: SistemaCorporal[];
  /** Las "carcasas" (piel) son translúcidas y ceden el clic a los órganos que tienen dentro. */
  carcasa?: boolean;
  crear: () => THREE.Object3D[];
}

const esfera = (r: number, x: number, y: number, z: number, escala: [number, number, number] = [1, 1, 1]) => {
  const g = new THREE.SphereGeometry(r, 32, 24);
  const m = new THREE.Mesh(g);
  m.position.set(x, y, z);
  m.scale.set(...escala);
  return m;
};
const capsula = (r: number, largo: number, x: number, y: number, z: number, rotZ = 0) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, largo, 8, 24));
  m.position.set(x, y, z);
  m.rotation.z = rotZ;
  return m;
};

const REGIONES: Region[] = [
  { id: 'cabeza', sistemas: ['cerebro'], crear: () => [esfera(0.24, 0, 1.62, 0, [0.95, 1.08, 1])] },
  { id: 'ojos', sistemas: ['ojos'], crear: () => [esfera(0.035, -0.08, 1.65, 0.215), esfera(0.035, 0.08, 1.65, 0.215)] },
  { id: 'oidos', sistemas: ['oidoInterno'], crear: () => [esfera(0.045, -0.235, 1.62, 0, [0.6, 1, 1]), esfera(0.045, 0.235, 1.62, 0, [0.6, 1, 1])] },
  { id: 'torso', sistemas: ['inmune'], carcasa: true, crear: () => [capsula(0.3, 0.5, 0, 1.05, 0)] },
  { id: 'columna', sistemas: ['huesos'], crear: () => [capsula(0.035, 0.85, 0, 1.03, -0.17)] },
  { id: 'pulmones', sistemas: ['pulmones'], crear: () => [esfera(0.11, -0.12, 1.2, 0, [1, 1.7, 0.9]), esfera(0.11, 0.12, 1.2, 0, [1, 1.7, 0.9])] },
  { id: 'corazon', sistemas: ['corazon'], crear: () => [esfera(0.075, 0.04, 1.14, 0.1)] },
  { id: 'abdomen', sistemas: ['metabolismo', 'intestino'], crear: () => [esfera(0.17, 0, 0.83, 0.03, [1.1, 0.75, 0.8])] },
  { id: 'brazos', sistemas: ['musculos'], carcasa: true, crear: () => [capsula(0.075, 0.62, -0.42, 1.0, 0, -0.18), capsula(0.075, 0.62, 0.42, 1.0, 0, 0.18)] },
  { id: 'piernas', sistemas: ['piernas'], carcasa: true, crear: () => [capsula(0.1, 0.72, -0.13, 0.26, 0), capsula(0.1, 0.72, 0.13, 0.26, 0)] },
];

interface Props {
  estado: EstadoCorporal;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (sistemas: SistemaCorporal[]) => void;
}

/** Devuelve false si el navegador no tiene WebGL (se usa la figura 2D). */
export function webglDisponible(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function FiguraCorporal3D({ estado, seleccion, onSeleccionar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mallas = useRef(new Map<string, THREE.Mesh[]>());
  const halo = useRef<THREE.Mesh | null>(null);
  const props = useRef({ estado, seleccion, onSeleccionar });
  props.current = { estado, seleccion, onSeleccionar };

  // Escena: se crea una sola vez.
  useEffect(() => {
    const div = contenedor.current!;
    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camara.position.set(0, 1.1, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    div.appendChild(renderer.domElement);

    escena.add(new THREE.AmbientLight(0xffffff, 1.1));
    const luz = new THREE.DirectionalLight(0xffffff, 1.6);
    luz.position.set(2, 4, 3);
    escena.add(luz);

    // Cuello neutro
    const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 16), new THREE.MeshStandardMaterial({ color: HEX.sinDatos, transparent: true, opacity: 0.4 }));
    cuello.position.set(0, 1.4, 0);
    escena.add(cuello);

    for (const r of REGIONES) {
      const lista: THREE.Mesh[] = [];
      for (const obj of r.crear()) {
        const m = obj as THREE.Mesh;
        m.material = new THREE.MeshStandardMaterial({
          color: HEX.sinDatos, roughness: 0.45, metalness: 0.05,
          transparent: !!r.carcasa, opacity: r.carcasa ? 0.28 : 1, depthWrite: !r.carcasa,
        });
        m.userData = { region: r.id, sistemas: r.sistemas, prioridad: r.carcasa ? 0 : 1 };
        m.renderOrder = r.carcasa ? 1 : 0;
        escena.add(m);
        lista.push(m);
      }
      mallas.current.set(r.id, lista);
    }

    // Halo = todo el cuerpo (radiación)
    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.02, 12, 96),
      new THREE.MeshBasicMaterial({ color: HEX.sinDatos, transparent: true, opacity: 0.9 }),
    );
    anillo.rotation.x = Math.PI / 2;
    anillo.position.y = -0.18; // aro a los pies: se ve como elipse desde la cámara
    anillo.userData = { region: 'halo', sistemas: ['cuerpo'], prioridad: 0 };
    escena.add(anillo);
    halo.current = anillo;

    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.set(0, 0.95, 0);
    controles.enablePan = false;
    controles.minDistance = 2.2;
    controles.maxDistance = 6;
    controles.autoRotate = true;
    controles.autoRotateSpeed = 1.2;
    controles.update();
    let reanudarGiro: ReturnType<typeof setTimeout> | undefined;
    controles.addEventListener('start', () => { controles.autoRotate = false; clearTimeout(reanudarGiro); });
    controles.addEventListener('end', () => { reanudarGiro = setTimeout(() => (controles.autoRotate = true), 4000); });

    // Clic (distinto de arrastrar) → selección
    const raycaster = new THREE.Raycaster();
    let inicio = { x: 0, y: 0 };
    const alPresionar = (e: PointerEvent) => (inicio = { x: e.clientX, y: e.clientY });
    const alSoltar = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const puntero = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(puntero, camara);
      const golpes = raycaster.intersectObjects(escena.children).filter((g) => g.object.userData.sistemas);
      if (!golpes.length) return;
      // Prioridad a los órganos sobre la piel translúcida
      const mejor = golpes.reduce((a, b) => (b.object.userData.prioridad > a.object.userData.prioridad ? b : a));
      props.current.onSeleccionar(mejor.object.userData.sistemas);
    };
    renderer.domElement.addEventListener('pointerdown', alPresionar);
    renderer.domElement.addEventListener('pointerup', alSoltar);

    const redimensionar = () => {
      const { clientWidth: w, clientHeight: h } = div;
      renderer.setSize(w, h);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(redimensionar);
    ro.observe(div);
    redimensionar();

    // Animación: el corazón late y las regiones en alerta pulsan.
    const reloj = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = reloj.getElapsedTime();
      const { estado: e } = props.current;
      const corazon = mallas.current.get('corazon')?.[0];
      if (corazon) corazon.scale.setScalar(1 + 0.08 * Math.max(0, Math.sin(t * 7)));
      for (const r of REGIONES) {
        const nivel = peorEstado(e, r.sistemas);
        const intensidad = nivel === 'alerta' ? 0.35 + 0.35 * Math.sin(t * 6) : nivel === 'aviso' ? 0.15 : 0;
        for (const m of mallas.current.get(r.id) ?? []) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = intensidad;
      }
      anillo.rotation.z = t * 0.4;
      controles.update();
      renderer.render(escena, camara);
    });

    return () => {
      renderer.setAnimationLoop(null);
      clearTimeout(reanudarGiro);
      ro.disconnect();
      controles.dispose();
      escena.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      });
      renderer.dispose();
      div.removeChild(renderer.domElement);
      mallas.current.clear();
    };
  }, []);

  // Colores según el estado y la selección.
  useEffect(() => {
    for (const r of REGIONES) {
      const nivel = peorEstado(estado, r.sistemas);
      const sel = seleccion?.join() === r.sistemas.join();
      for (const m of mallas.current.get(r.id) ?? []) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.color.setHex(HEX[nivel]);
        mat.emissive.setHex(HEX[nivel]);
        if (r.carcasa) mat.opacity = sel ? 0.55 : 0.28;
      }
    }
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).color.setHex(HEX[estado.cuerpo]);
  }, [estado, seleccion]);

  const regionesConEstado = REGIONES.map((r) => ({ r, nivel: peorEstado(estado, r.sistemas) }));

  return (
    <div className="figura">
      <div ref={contenedor} className="lienzo-3d" role="img" aria-label="Figura 3D con el estado de salud por sistema corporal" />
      <p className="ayuda">Arrastra para rotar · clic en una región para ver el detalle</p>
      {/* Alternativa accesible y para teclado: las mismas regiones como botones */}
      <div className="regiones-accesibles">
        {[...regionesConEstado, { r: { id: 'halo', sistemas: ['cuerpo'] as SistemaCorporal[] }, nivel: estado.cuerpo }].map(({ r, nivel }) => (
          <button key={r.id} onClick={() => onSeleccionar(r.sistemas)} aria-pressed={seleccion?.join() === r.sistemas.join()}>
            <span className="punto" style={{ background: COLOR_NIVEL[nivel] }} />
            {r.sistemas.map((s) => NOMBRE_SISTEMA[s]).join(' / ')}
            <span className="sr-only"> · {NOMBRE_NIVEL[nivel]}</span>
          </button>
        ))}
      </div>
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className="punto" style={{ background: COLOR_NIVEL[n] }} />{NOMBRE_NIVEL[n]}</li>
        ))}
      </ul>
    </div>
  );
}
