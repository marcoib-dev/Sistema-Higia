/**
 * ANATOMÍA VECTORIAL — órganos dibujados en SVG y su clasificación por sistemas del cuerpo
 * (respiratorio, circulatorio, digestivo, urinario, nervioso, endocrino, inmune, muscular, óseo).
 *
 * Todo está en el lienzo común de la figura (400 × 900, eje del cuerpo en x = 200), vista de frente:
 * la izquierda del dibujo es el lado derecho de la persona (el hígado queda a la izquierda, el estómago
 * a la derecha). La vista de espalda es el espejo de estas mismas formas.
 *
 * Cada órgano se tiñe con el estado de un sistema de salud del motor (`SistemaCorporal`), así la
 * clasificación anatómica es solo de la interfaz y no cambia las reglas.
 */
import type { RegionCuerpo, SistemaCorporal } from '../core/tipos';

// ── Geometría ──────────────────────────────────────────────────────────

export type Punto = [number, number];
/** Contorno cerrado (o línea, en los trazos): vértices [x, y]. */
export type Puntos = Punto[];

export const ANCHO = 400;
export const ALTO = 900;
export const EJE = ANCHO / 2;

const r1 = (v: number) => Math.round(v * 10) / 10;
const medio = (a: Punto, b: Punto): Punto => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * Curva cerrada con cuadráticas por el punto medio de cada arista: el contorno pasa pegado a los
 * vértices trazados sin sobrepasarlos.
 */
export function curva(puntos: Puntos): string {
  const n = puntos.length;
  const inicio = medio(puntos[n - 1], puntos[0]);
  let d = `M ${r1(inicio[0])} ${r1(inicio[1])}`;
  for (let i = 0; i < n; i++) {
    const p = puntos[i];
    const m = medio(p, puntos[(i + 1) % n]);
    d += ` Q ${r1(p[0])} ${r1(p[1])} ${r1(m[0])} ${r1(m[1])}`;
  }
  return `${d} Z`;
}

/** Línea abierta suave que empieza y termina en los extremos (surcos, fisuras, ramas). */
export function linea(puntos: Puntos): string {
  const n = puntos.length;
  let d = `M ${r1(puntos[0][0])} ${r1(puntos[0][1])}`;
  if (n === 2) return `${d} L ${r1(puntos[1][0])} ${r1(puntos[1][1])}`;
  for (let i = 1; i < n - 1; i++) {
    const m = i === n - 2 ? puntos[n - 1] : medio(puntos[i], puntos[i + 1]);
    d += ` Q ${r1(puntos[i][0])} ${r1(puntos[i][1])} ${r1(m[0])} ${r1(m[1])}`;
  }
  return d;
}

/** Estructura par: el contorno y su espejo respecto al eje del cuerpo. */
export const espejo = (p: Puntos): Puntos => p.map(([x, y]) => [2 * EJE - x, y] as Punto);
export const par = (p: Puntos): Puntos[] => [p, espejo(p)];
const bajar = (p: Puntos, dy: number): Puntos => p.map(([x, y]) => [x, y + dy] as Punto);

/** Nódulo redondeado como contorno vectorial. */
export const circulo = (cx: number, cy: number, r: number, n = 12): Puntos =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Punto;
  });

/** Contorno de un tubo (vaso, nervio, conducto) alrededor de su línea central; el ancho va de `w0` a `w1`. */
export function tubo(centro: Puntos, w0: number, w1 = w0): Puntos {
  const n = centro.length;
  const izq: Puntos = [];
  const der: Puntos = [];
  for (let i = 0; i < n; i++) {
    const a = centro[Math.max(i - 1, 0)];
    const b = centro[Math.min(i + 1, n - 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const largo = Math.hypot(dx, dy) || 1;
    const w = (w0 + ((w1 - w0) * i) / (n - 1)) / 2;
    const [x, y] = centro[i];
    izq.push([x - (dy / largo) * w, y + (dx / largo) * w]);
    der.push([x + (dy / largo) * w, y - (dx / largo) * w]);
  }
  // Extremos un poco redondeados: se repite el centro de cada punta.
  const fin = centro[n - 1];
  const ini = centro[0];
  return [...izq, fin, ...der.reverse(), ini];
}

/** Segmentos cortos perpendiculares a un tubo (anillos de la tráquea, haustras del colon), uno cada `cada` vértices. */
export function travesanos(centro: Puntos, w: number, cada = 1, desde = 1): Puntos[] {
  const out: Puntos[] = [];
  for (let i = desde; i < centro.length - 1; i += cada) {
    const a = centro[i - 1];
    const b = centro[i + 1];
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / largo * (w / 2);
    const ny = (b[0] - a[0]) / largo * (w / 2);
    const [x, y] = centro[i];
    out.push([[x + nx, y + ny], [x - nx, y - ny]]);
  }
  return out;
}

// ── Órganos ────────────────────────────────────────────────────────────

export interface Organo {
  id: string;
  nombre: string;
  /** Sistema de salud del motor cuyo estado tiñe el órgano (y que se selecciona al tocarlo). */
  sistema: SistemaCorporal;
  /** Región del cuerpo: un hallazgo localizado también lo tiñe. */
  region?: RegionCuerpo;
  formas: Puntos[];
  /** Detalle interno (fisuras, surcos, ramas, anillos): líneas abiertas sobre el órgano. */
  trazos?: Puntos[];
  /** Estructura secundaria (venas, nervios finos): se dibuja más tenue. */
  tenue?: boolean;
  /** Solo tiene sentido de frente (p. ej. los ojos). */
  soloFrente?: boolean;
}

const o = (id: string, nombre: string, sistema: SistemaCorporal, region: RegionCuerpo | undefined, formas: Puntos[], extra: Partial<Organo> = {}): Organo =>
  ({ id, nombre, sistema, region, formas, ...extra });

// Respiratorio ─────────────────────────────────────────────────────────

const NARIZ_FARINGE = tubo([[200, 94], [200, 104], [201, 114], [200, 126], [200, 138]], 10, 7);
const LARINGE: Puntos = [[194, 137], [206, 137], [209, 145], [206, 154], [194, 154], [191, 145]];
const TRAQUEA = tubo([[200, 153], [200, 175], [200, 196], [200, 208]], 9);
const ANILLOS_TRAQUEA: Puntos[] = [158, 164, 170, 176, 182, 188, 194, 200].map((y) => [[196.5, y], [203.5, y]] as Puntos);
const BRONQUIOS: Puntos[] = [
  tubo([[200, 206], [193, 213], [185, 221], [178, 230]], 6.5, 4),
  tubo([[200, 206], [209, 212], [218, 219], [225, 228]], 6.5, 4),
];
const PULMON_DER: Puntos = [
  [178, 176], [166, 184], [154, 200], [145, 222], [139, 248], [136, 272], [137, 292], [150, 296],
  [166, 290], [182, 288], [190, 282], [191, 256], [190, 232], [189, 212], [186, 190],
];
const PULMON_IZQ: Puntos = [
  [222, 176], [234, 184], [246, 200], [255, 222], [261, 248], [264, 272], [263, 294], [250, 298],
  [236, 294], [228, 288], [231, 276], [225, 263], [214, 251], [211, 232], [211, 212], [214, 190],
];
const RAMAS_PULMON_DER: Puntos[] = [
  [[188, 212], [172, 238], [158, 264], [150, 292]], // fisura oblicua
  [[174, 240], [158, 237], [141, 240]], // fisura horizontal
  [[178, 230], [168, 246], [162, 266], [158, 280]],
  [[178, 230], [164, 224], [152, 216]],
  [[168, 246], [152, 252]],
];
const RAMAS_PULMON_IZQ: Puntos[] = [
  [[214, 204], [232, 234], [246, 262], [253, 294]], // fisura oblicua
  [[225, 228], [236, 244], [242, 264], [246, 280]],
  [[225, 228], [238, 220], [250, 214]],
  [[236, 244], [252, 250]],
];
const DIAFRAGMA = tubo([[132, 307], [146, 297], [166, 290], [186, 293], [200, 299], [214, 293], [234, 290], [254, 297], [268, 307]], 5);

// Circulatorio ─────────────────────────────────────────────────────────

const CORAZON: Puntos = [
  [204, 214], [216, 210], [230, 213], [240, 222], [245, 236], [243, 254], [236, 270], [227, 284],
  [220, 294], [212, 290], [202, 280], [194, 266], [190, 250], [191, 234], [196, 222],
];
const SURCOS_CORAZON: Puntos[] = [
  [[191, 238], [206, 234], [224, 226], [240, 224]], // surco coronario
  [[212, 232], [214, 252], [217, 272], [220, 292]], // surco interventricular
];
const AORTA = tubo([
  [210, 220], [205, 206], [204, 194], [209, 185], [217, 181], [225, 184], [229, 194], [227, 210],
  [221, 230], [212, 262], [206, 300], [203, 340], [201, 392],
], 7.5, 5.5);
const ILIACAS = par(tubo([[201, 391], [189, 407], [177, 424], [168, 442]], 5, 4.5));
const CAROTIDAS: Puntos[] = [
  tubo([[207, 186], [199, 180], [193, 170], [190, 150], [188, 130], [186, 112]], 4, 3),
  tubo([[215, 182], [211, 170], [210, 150], [212, 130], [214, 112]], 4, 3),
];
/** Por la cara interna del brazo (silueta medida en la ilustración: el brazo baja casi recto de x ≈ 100 a x ≈ 75). */
const ARTERIA_BRAZO: Puntos = [
  [160, 190], [138, 196], [120, 208], [110, 228], [106, 252], [103, 280], [99, 310], [93, 340], [88, 370], [83, 400], [78, 430], [76, 458],
];
const ARTERIAS_BRAZOS: Puntos[] = [
  tubo([[199, 181], [180, 186], ...ARTERIA_BRAZO], 4, 2.6),
  tubo([[226, 186], [236, 188], ...espejo(ARTERIA_BRAZO)], 4, 2.6),
];
const ARTERIAS_PIERNAS = par(tubo([
  [168, 442], [161, 470], [157, 510], [153, 560], [151, 610], [147, 650], [142, 700], [138, 750], [136, 800], [134, 840],
], 4.5, 3));
const VENAS_CAVAS: Puntos[] = [
  tubo([[192, 244], [191, 222], [191, 198], [192, 190]], 7, 6.5),
  tubo([[194, 292], [196, 330], [197, 362], [197, 392]], 7),
];
const YUGULARES = par(tubo([[192, 191], [183, 172], [180, 150], [180, 128], [178, 108]], 4, 3));
const VENAS_PIERNAS = par(tubo([
  [197, 392], [188, 410], [178, 428], [172, 446], [166, 476], [161, 520], [157, 570], [155, 620], [151, 660], [147, 710], [144, 760], [142, 810],
], 5, 3.2));

// Digestivo ────────────────────────────────────────────────────────────

const BOCA: Puntos = [[191, 124], [200, 121], [209, 124], [207, 129], [200, 131], [193, 129]];
const ESOFAGO = tubo([[200, 128], [200, 142], [200, 165], [200, 192], [201, 222], [203, 250], [207, 276], [212, 294], [219, 304]], 6.5, 6);
const HIGADO: Puntos = [
  [136, 302], [150, 293], [172, 290], [196, 292], [216, 296], [228, 302], [218, 310], [204, 318],
  [190, 328], [176, 340], [162, 350], [148, 354], [140, 346], [135, 330], [134, 314],
];
const LOBULOS_HIGADO: Puntos[] = [[[204, 296], [196, 310], [190, 326]], [[150, 312], [166, 322], [176, 336]]];
const VESICULA: Puntos = [[166, 336], [174, 333], [181, 341], [181, 352], [175, 359], [167, 355], [164, 346]];
const ESTOMAGO: Puntos = [
  [215, 302], [222, 294], [236, 293], [248, 300], [256, 314], [256, 330], [250, 344], [238, 356],
  [220, 362], [202, 362], [190, 358], [184, 352], [186, 344], [198, 348], [214, 348], [228, 340],
  [235, 328], [234, 316], [227, 308], [219, 306],
];
const PLIEGUES_ESTOMAGO: Puntos[] = [[[240, 310], [242, 326], [234, 342], [216, 354]], [[249, 318], [246, 336], [234, 350]]];
const PANCREAS: Puntos = [
  [178, 358], [188, 354], [204, 356], [220, 354], [236, 348], [250, 342], [257, 346], [251, 354],
  [233, 362], [215, 368], [199, 374], [187, 378], [176, 372],
];
const CONDUCTO_PANCREAS: Puntos[] = [[[186, 368], [204, 365], [222, 359], [246, 348]]];
const DUODENO = tubo([[186, 350], [178, 356], [172, 366], [172, 378], [178, 388], [190, 392], [204, 391]], 7);
/** Asas del yeyuno e íleon: una serpentina que llena el marco del colon y termina en el ciego. */
const CENTRO_DELGADO: Puntos = [
  [206, 394], [222, 398], [232, 406], [222, 414], [198, 414], [176, 416], [172, 424], [190, 427],
  [214, 425], [234, 428], [234, 437], [214, 439], [190, 438], [172, 440], [172, 449], [194, 451],
  [218, 449], [232, 452], [226, 461], [204, 462], [184, 461], [168, 458],
];
const DELGADO = tubo(CENTRO_DELGADO, 8);
const CENTRO_GRUESO: Puntos = [
  [160, 462], [157, 446], [155, 428], [155, 410], [158, 396], [168, 389], [184, 396], [200, 401],
  [218, 397], [236, 389], [247, 394], [251, 410], [252, 428], [252, 446], [247, 460], [233, 468],
  [216, 470], [206, 478], [201, 494],
];
const GRUESO = tubo(CENTRO_GRUESO, 14, 9);
const APENDICE = tubo([[159, 466], [162, 475], [160, 484]], 4.5, 3.5);
const HAUSTRAS = travesanos(CENTRO_GRUESO.slice(0, 16), 13, 1, 1);

// Urinario ─────────────────────────────────────────────────────────────

const RINON: Puntos = [
  [176, 320], [166, 320], [158, 328], [154, 342], [156, 356], [164, 366], [174, 368], [182, 362],
  [184, 352], [180, 344], [184, 334], [182, 326],
];
const PELVIS_RENAL: Puntos[] = [[[180, 344], [172, 339], [165, 332]], [[180, 344], [170, 350], [164, 357]], [[180, 344], [168, 344]]];
const URETERES: Puntos[] = [
  tubo([[181, 347], [186, 372], [188, 402], [190, 430], [193, 452]], 3.5),
  tubo([[219, 341], [214, 368], [212, 400], [210, 430], [207, 452]], 3.5),
];
const VEJIGA: Puntos = [[200, 448], [212, 450], [220, 458], [220, 470], [212, 478], [200, 481], [188, 478], [180, 470], [180, 458], [188, 450]];
const URETRA = tubo([[200, 479], [200, 488], [200, 497]], 3.2);

// Nervioso ─────────────────────────────────────────────────────────────

const CEREBRO: Puntos = [
  [200, 24], [219, 28], [232, 38], [238, 55], [237, 72], [232, 86], [224, 94], [214, 97], [205, 91],
  [200, 89], [195, 91], [186, 97], [176, 94], [168, 86], [163, 72], [162, 55], [168, 38], [181, 28],
];
const CIRCUNVOLUCIONES: Puntos[] = [
  [[200, 28], [200, 52], [200, 86]],
  [[172, 46], [184, 42], [190, 52], [180, 60], [188, 70]],
  [[228, 46], [216, 42], [210, 52], [220, 60], [212, 70]],
  [[167, 68], [178, 74], [176, 86]],
  [[233, 68], [222, 74], [224, 86]],
];
const CEREBELO: Puntos = [
  [180, 92], [192, 96], [200, 100], [208, 96], [220, 92], [228, 101], [222, 112], [208, 116],
  [200, 112], [192, 116], [178, 112], [172, 101],
];
const TRONCO = tubo([[200, 92], [200, 108], [200, 126], [200, 142]], 12, 8);
const MEDULA = tubo([[200, 140], [200, 190], [200, 250], [200, 310], [200, 352]], 6, 4);
const COLA_DE_CABALLO: Puntos[] = [[[200, 350], [197, 390], [193, 424]], [[200, 350], [203, 390], [207, 424]], [[200, 350], [200, 400], [200, 430]]];
const NERVIOS: Puntos[] = [
  ...par(tubo([
    [200, 178], [186, 186], [164, 192], [142, 200], [124, 212], [114, 232], [110, 256], [107, 282],
    [103, 310], [97, 340], [91, 370], [86, 400], [81, 430], [79, 458],
  ], 2.6, 1.8)),
  ...[232, 258, 284].flatMap((y) => par(tubo([[200, y], [182, y + 2], [162, y + 8], [146, y + 18]], 1.8, 1.2))),
  ...par(tubo([
    [200, 382], [186, 404], [172, 428], [164, 456], [158, 500], [154, 550], [152, 600], [150, 640],
    [144, 690], [140, 740], [138, 790], [136, 830],
  ], 3, 2)),
];
const OJO: Puntos = [[175, 88], [180, 84], [187, 84], [192, 87], [188, 92], [181, 92]];
const PUPILAS: Puntos[] = par([...circulo(183.5, 88, 2.2, 8), [185.7, 88]]);
const OIDO: Puntos = [[153, 82], [160, 86], [162, 96], [160, 107], [154, 113], [149, 106], [149, 94]];
const CARACOL: Puntos[] = par([[156, 101], [158, 97], [156, 94], [153, 97], [155, 102], [159, 101]]);

// Endocrino ────────────────────────────────────────────────────────────

const HIPOFISIS = circulo(200, 77, 4.5, 10);
const TIROIDES: Puntos = [
  [200, 160], [194, 152], [187, 153], [184, 163], [187, 172], [194, 172], [200, 167], [206, 172],
  [213, 172], [216, 163], [213, 153], [206, 152],
];
const SUPRARRENAL: Puntos = [[163, 320], [168, 309], [176, 306], [183, 312], [185, 321], [176, 323]];

// Inmune (órganos que se muestran junto a las métricas) ────────────────

const BAZO: Puntos = [[248, 300], [258, 302], [266, 312], [270, 328], [266, 342], [256, 348], [250, 342], [252, 328], [248, 314], [244, 306]];
const TIMO: Puntos = [[200, 192], [192, 196], [188, 208], [190, 222], [196, 232], [200, 228], [204, 232], [210, 222], [212, 208], [208, 196]];

// ── Clasificación por sistemas ─────────────────────────────────────────

export type SistemaAnatomico =
  | 'respiratorio' | 'circulatorio' | 'digestivo' | 'urinario' | 'nervioso' | 'endocrino'
  | 'inmune' | 'muscular' | 'oseo';

export interface InfoSistemaAnatomico {
  nombre: string;
  /** Qué se ve al elegirlo: órganos vectoriales, la ilustración de músculos o huesos, o métricas. */
  modo: 'organos' | 'ilustracion' | 'metricas';
  descripcion: string;
}

export const SISTEMAS_ANATOMICOS: Record<SistemaAnatomico, InfoSistemaAnatomico> = {
  respiratorio: { nombre: 'Respiratorio', modo: 'organos', descripcion: 'Vías aéreas, pulmones y diafragma' },
  circulatorio: { nombre: 'Circulatorio', modo: 'organos', descripcion: 'Corazón, arterias y venas' },
  digestivo: { nombre: 'Digestivo', modo: 'organos', descripcion: 'Del esófago al recto, con hígado y páncreas' },
  urinario: { nombre: 'Urinario', modo: 'organos', descripcion: 'Riñones, uréteres, vejiga y uretra' },
  nervioso: { nombre: 'Nervioso', modo: 'organos', descripcion: 'Encéfalo, médula, nervios y sentidos' },
  endocrino: { nombre: 'Endocrino', modo: 'organos', descripcion: 'Glándulas que regulan el metabolismo' },
  inmune: { nombre: 'Inmune', modo: 'metricas', descripcion: 'Defensas: se siguen con mediciones, no en la figura' },
  muscular: { nombre: 'Muscular', modo: 'ilustracion', descripcion: 'Músculos principales' },
  oseo: { nombre: 'Óseo', modo: 'ilustracion', descripcion: 'Esqueleto' },
};

export const ORDEN_SISTEMAS = Object.keys(SISTEMAS_ANATOMICOS) as SistemaAnatomico[];

/** Órganos de cada sistema, en orden de dibujo (lo de atrás primero). */
export const ORGANOS: Partial<Record<SistemaAnatomico, Organo[]>> = {
  respiratorio: [
    o('diafragma', 'Diafragma', 'pulmones', 'torax', [DIAFRAGMA]),
    o('pulmones', 'Pulmones', 'pulmones', 'torax', [PULMON_DER, PULMON_IZQ], { trazos: [...RAMAS_PULMON_DER, ...RAMAS_PULMON_IZQ] }),
    o('bronquios', 'Bronquios', 'pulmones', 'torax', BRONQUIOS),
    o('traquea', 'Tráquea', 'pulmones', 'cuello', [TRAQUEA], { trazos: ANILLOS_TRAQUEA }),
    o('laringe', 'Laringe', 'pulmones', 'cuello', [LARINGE], { trazos: [[[196, 145], [204, 145]]] }),
    o('nariz', 'Nariz y faringe', 'pulmones', 'cara', [NARIZ_FARINGE]),
  ],
  circulatorio: [
    o('venas', 'Venas principales (cavas, yugulares, ilíacas)', 'corazon', undefined, [...VENAS_CAVAS, ...YUGULARES, ...VENAS_PIERNAS], { tenue: true }),
    o('arterias', 'Arterias (carótidas, brazos y piernas)', 'corazon', undefined, [...CAROTIDAS, ...ARTERIAS_BRAZOS, ...ARTERIAS_PIERNAS]),
    o('aorta', 'Aorta y arterias ilíacas', 'corazon', 'torax', [AORTA, ...ILIACAS]),
    o('corazon', 'Corazón', 'corazon', 'torax', [CORAZON], { trazos: SURCOS_CORAZON }),
  ],
  digestivo: [
    o('delgado', 'Intestino delgado', 'intestino', 'abdomen', [DUODENO, DELGADO]),
    o('grueso', 'Intestino grueso, apéndice y recto', 'intestino', 'abdomen', [GRUESO, APENDICE], { trazos: HAUSTRAS }),
    o('pancreas', 'Páncreas', 'metabolismo', 'abdomen', [PANCREAS], { trazos: CONDUCTO_PANCREAS }),
    o('esofago', 'Esófago', 'intestino', 'torax', [ESOFAGO]),
    o('estomago', 'Estómago', 'intestino', 'abdomen', [ESTOMAGO], { trazos: PLIEGUES_ESTOMAGO }),
    o('higado', 'Hígado', 'metabolismo', 'abdomen', [HIGADO], { trazos: LOBULOS_HIGADO }),
    o('vesicula', 'Vesícula biliar', 'metabolismo', 'abdomen', [VESICULA]),
    o('boca', 'Boca', 'intestino', 'cara', [BOCA], { soloFrente: true }),
  ],
  urinario: [
    o('ureteres', 'Uréteres', 'metabolismo', 'abdomen', URETERES),
    o('rinones', 'Riñones', 'metabolismo', 'abdomen', [RINON, bajar(espejo(RINON), -6)], { trazos: [...PELVIS_RENAL, ...PELVIS_RENAL.map((t) => bajar(espejo(t), -6))] }),
    o('vejiga', 'Vejiga', 'metabolismo', 'pelvis', [VEJIGA], { trazos: [[[188, 466], [200, 472], [212, 466]]] }),
    o('uretra', 'Uretra', 'metabolismo', 'pelvis', [URETRA]),
  ],
  nervioso: [
    o('nervios', 'Nervios periféricos', 'cerebro', undefined, NERVIOS, { tenue: true, trazos: COLA_DE_CABALLO }),
    o('medula', 'Médula espinal', 'cerebro', 'columna', [MEDULA]),
    o('cerebelo', 'Cerebelo', 'cerebro', 'craneo', [CEREBELO], { trazos: [[[184, 106], [200, 106], [216, 106]]] }),
    o('tronco', 'Tronco encefálico', 'cerebro', 'craneo', [TRONCO]),
    o('cerebro', 'Cerebro', 'cerebro', 'craneo', [CEREBRO], { trazos: CIRCUNVOLUCIONES }),
    o('oido', 'Oído interno', 'oidoInterno', 'craneo', par(OIDO), { trazos: CARACOL }),
    o('ojos', 'Ojos', 'ojos', 'cara', par(OJO), { trazos: PUPILAS, soloFrente: true }),
  ],
  endocrino: [
    o('hipofisis', 'Hipotálamo e hipófisis', 'metabolismo', 'craneo', [HIPOFISIS]),
    o('tiroides', 'Tiroides', 'metabolismo', 'cuello', [TIROIDES], { trazos: [[[200, 160], [200, 167]]] }),
    o('suprarrenales', 'Glándulas suprarrenales', 'metabolismo', 'abdomen', [SUPRARRENAL, bajar(espejo(SUPRARRENAL), -6)]),
    o('pancreas', 'Páncreas (islotes)', 'metabolismo', 'abdomen', [PANCREAS], { trazos: CONDUCTO_PANCREAS }),
  ],
};

/**
 * Órganos del sistema inmune: no se ubican en la figura (el sistema se sigue con métricas), cada uno
 * se muestra como miniatura. Los que no tienen un lugar claro en el cuerpo tienen su propio dibujo.
 */
export const ORGANOS_INMUNES: (Organo & { funcion: string })[] = [
  { ...o('bazo', 'Bazo', 'inmune', 'abdomen', [BAZO], { trazos: [[[254, 314], [257, 328], [255, 338]]] }), funcion: 'Filtra la sangre y guarda glóbulos blancos' },
  { ...o('timo', 'Timo', 'inmune', 'torax', [TIMO], { trazos: [[[200, 198], [200, 226]]] }), funcion: 'Madura los linfocitos T' },
  {
    ...o('ganglios', 'Ganglios linfáticos', 'inmune', undefined, [circulo(20, 20, 7), circulo(44, 28, 6), circulo(27, 46, 6.5)], {
      trazos: [[[2, 10], [13, 16]], [[27, 22], [38, 26]], [[50, 31], [60, 38]], [[22, 27], [25, 39]], [[28, 53], [30, 64]]],
    }),
    funcion: 'Filtran la linfa y activan defensas',
  },
  { ...o('amigdalas', 'Amígdalas', 'inmune', 'cuello', [circulo(193, 126, 3.4, 10), circulo(207, 126, 3.4, 10)], { trazos: [[[188, 120], [200, 116], [212, 120]]] }), funcion: 'Primera barrera en la garganta' },
  {
    ...o('medula-osea', 'Médula ósea', 'inmune', undefined, [[
      [12, 4], [22, 2], [30, 6], [30, 14], [26, 20], [25, 46], [29, 52], [31, 60], [24, 66], [14, 66], [8, 60], [12, 52], [15, 46], [14, 20], [9, 14], [8, 8],
    ]], { trazos: [[[17, 22], [22, 22], [22, 46], [18, 46], [17, 22]]] }),
    funcion: 'Fabrica las células de la sangre y las defensas',
  },
];

/** Caja [x, y, ancho, alto] que contiene un órgano, con margen: para dibujarlo como miniatura. */
export function cajaOrgano(org: Organo, margen = 4): [number, number, number, number] {
  const pts = [...org.formas, ...(org.trazos ?? [])].flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - margen;
  const y0 = Math.min(...ys) - margen;
  const lado = Math.max(Math.max(...xs) - x0 + margen, Math.max(...ys) - y0 + margen);
  // Cuadrada y centrada, para que todas las miniaturas tengan la misma escala visual.
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return [r1(cx - lado / 2), r1(cy - lado / 2), r1(lado), r1(lado)];
}
