/**
 * FIGURA 3D — modo pasivo. Cuerpo humano realista en pose "A" (ver figura3d/anatomia.ts),
 * con piel translúcida y malla de cuadros, y órganos internos coloreados por estado.
 * Arrastra para rotar, rueda para acercar, clic para ver el detalle de una región.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type EstadoCorporal, type Nivel, type SistemaCorporal } from '../core/tipos';
import { COLOR_NIVEL, NOMBRE_NIVEL, peorEstado } from './FiguraCorporal';
import { construirSegmento, ORGANOS, PIEL } from './figura3d/anatomia';

type EstadoVisual = Nivel | 'sinDatos';

/** Mismos colores que los tokens CSS; three.js necesita valores concretos. */
const HEX: Record<EstadoVisual, number> = {
  normal: 0x3fbf7f, info: 0x4f9cf0, aviso: 0xf0b13c, alerta: 0xef5350, sinDatos: 0x8a93ad,
};
const COLOR_PIEL = new THREE.Color(0xd5d9e2);
const OPACIDAD_PIEL = 0.34;

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

interface Pintable {
  sistemas: SistemaCorporal[];
  esPiel: boolean;
  superficies: THREE.Mesh[];
  lineas: THREE.LineSegments[];
}

export function FiguraCorporal3D({ estado, seleccion, onSeleccionar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const pintables = useRef(new Map<string, Pintable>());
  const halo = useRef<THREE.Mesh | null>(null);
  const props = useRef({ estado, seleccion, onSeleccionar });
  props.current = { estado, seleccion, onSeleccionar };

  // Escena: se crea una sola vez.
  useEffect(() => {
    const div = contenedor.current!;
    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camara.position.set(0.8, 1.1, 3.55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    div.appendChild(renderer.domElement);

    // Iluminación de estudio, como la referencia.
    escena.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.2));
    const clave = new THREE.DirectionalLight(0xffffff, 1.8);
    clave.position.set(2, 3, 3);
    escena.add(clave);
    const contra = new THREE.DirectionalLight(0x9db4ff, 1.0);
    contra.position.set(-2, 2, -3);
    escena.add(contra);

    // Órganos: opacos, se dibujan primero.
    for (const o of ORGANOS) {
      const superficies = o.crear().map((m) => {
        m.material = new THREE.MeshStandardMaterial({ color: HEX.sinDatos, roughness: 0.4, metalness: 0.05, emissive: HEX.sinDatos, emissiveIntensity: 0 });
        m.userData = { sistemas: o.sistemas, prioridad: 1 };
        m.renderOrder = 0;
        escena.add(m);
        return m;
      });
      pintables.current.set(o.id, { sistemas: o.sistemas, esPiel: false, superficies, lineas: [] });
    }

    // Piel: 1) pasada de profundidad invisible, 2) color translúcido solo de la capa frontal, 3) malla de cuadros.
    const desfase = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    for (const parte of PIEL) {
      const p: Pintable = { sistemas: parte.sistemas, esPiel: true, superficies: [], lineas: [] };
      for (const seg of parte.segmentos) {
        const { superficie, malla } = construirSegmento(seg);

        const profundidad = new THREE.Mesh(superficie, new THREE.MeshBasicMaterial({ colorWrite: false, ...desfase }));
        profundidad.renderOrder = 1;
        profundidad.raycast = () => {}; // no participa en los clics
        escena.add(profundidad);

        const color = new THREE.Mesh(superficie, new THREE.MeshStandardMaterial({
          color: COLOR_PIEL, roughness: 0.75, metalness: 0, transparent: true, opacity: OPACIDAD_PIEL,
          depthWrite: false, depthFunc: THREE.LessEqualDepth, emissive: 0x000000, ...desfase,
        }));
        color.renderOrder = 2;
        color.userData = { sistemas: parte.sistemas, prioridad: 0 };
        escena.add(color);
        p.superficies.push(color);

        const lineas = new THREE.LineSegments(malla, new THREE.LineBasicMaterial({ color: 0xeef1f7, transparent: true, opacity: 0.22 }));
        lineas.renderOrder = 3;
        lineas.raycast = () => {};
        escena.add(lineas);
        p.lineas.push(lineas);
      }
      pintables.current.set(parte.id, p);
    }

    // Halo = todo el cuerpo (radiación): aro a los pies.
    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.012, 12, 128),
      new THREE.MeshBasicMaterial({ color: HEX.sinDatos, transparent: true, opacity: 0.9 }),
    );
    anillo.rotation.x = Math.PI / 2;
    anillo.position.y = -0.01;
    anillo.userData = { sistemas: ['cuerpo'], prioridad: 0 };
    escena.add(anillo);
    halo.current = anillo;

    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.set(0, 0.93, 0);
    controles.enablePan = false;
    controles.minDistance = 1.6;
    controles.maxDistance = 6;
    controles.autoRotate = true;
    controles.autoRotateSpeed = 1.0;
    controles.update();
    let reanudarGiro: ReturnType<typeof setTimeout> | undefined;
    controles.addEventListener('start', () => { controles.autoRotate = false; clearTimeout(reanudarGiro); });
    controles.addEventListener('end', () => { reanudarGiro = setTimeout(() => (controles.autoRotate = true), 4000); });

    // Clic (distinto de arrastrar) → selección. Prioridad a los órganos sobre la piel.
    const raycaster = new THREE.Raycaster();
    let inicio = { x: 0, y: 0 };
    const alPresionar = (e: PointerEvent) => (inicio = { x: e.clientX, y: e.clientY });
    const alSoltar = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const puntero = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(puntero, camara);
      const golpes = raycaster.intersectObjects(escena.children).filter((g) => g.object.userData.sistemas?.length);
      if (!golpes.length) return;
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

    // Animación: el corazón late y lo que está en alerta pulsa.
    const reloj = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const t = reloj.getElapsedTime();
      const corazon = pintables.current.get('corazon')?.superficies[0];
      if (corazon) corazon.scale.set(1, 1.15, 0.9).multiplyScalar(1 + 0.08 * Math.max(0, Math.sin(t * 7)));
      for (const p of pintables.current.values()) {
        if (!p.sistemas.length) continue;
        const nivel = peorEstado(props.current.estado, p.sistemas);
        const intensidad = nivel === 'alerta' ? 0.35 + 0.35 * Math.sin(t * 6) : nivel === 'aviso' ? 0.15 : 0;
        for (const m of p.superficies) (m.material as THREE.MeshStandardMaterial).emissiveIntensity = intensidad * (p.esPiel ? 0.6 : 1);
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
      renderer.domElement.removeEventListener('pointerdown', alPresionar);
      renderer.domElement.removeEventListener('pointerup', alSoltar);
      escena.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      });
      renderer.dispose();
      div.removeChild(renderer.domElement);
      pintables.current.clear();
    };
  }, []);

  // Colores según el estado y la selección.
  useEffect(() => {
    for (const p of pintables.current.values()) {
      const nivel = peorEstado(estado, p.sistemas);
      const sel = p.sistemas.length > 0 && seleccion?.join() === p.sistemas.join();
      for (const m of p.superficies) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (p.esPiel) {
          // La piel se tiñe suavemente hacia el color del estado de su región.
          mat.color.copy(COLOR_PIEL).lerp(new THREE.Color(HEX[nivel]), p.sistemas.length && nivel !== 'sinDatos' ? 0.55 : 0);
          mat.emissive.setHex(p.sistemas.length ? HEX[nivel] : 0x000000);
          mat.opacity = sel ? 0.6 : OPACIDAD_PIEL;
        } else {
          mat.color.setHex(HEX[nivel]);
          mat.emissive.setHex(HEX[nivel]);
        }
      }
      for (const l of p.lineas) (l.material as THREE.LineBasicMaterial).opacity = sel ? 0.45 : 0.22;
    }
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).color.setHex(HEX[estado.cuerpo]);
  }, [estado, seleccion]);

  return (
    <div className="figura">
      <div ref={contenedor} className="lienzo-3d" role="img" aria-label="Figura 3D con el estado de salud por sistema corporal" />
      <p className="ayuda">Arrastra para rotar · rueda para acercar · clic en una región para ver su detalle</p>
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className="punto" style={{ background: COLOR_NIVEL[n] }} />{NOMBRE_NIVEL[n]}</li>
        ))}
      </ul>
    </div>
  );
}
