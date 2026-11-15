/**
 * FIGURA ANATÓMICA 2D — ilustraciones del cuerpo por categoría (órganos, músculos, huesos) y vista
 * (frente, espalda). En cada categoría solo aparece lo que se pidió: su ilustración y sus zonas.
 *
 * Las imágenes se muestran sin su fondo (un filtro SVG convierte la luminancia en transparencia) y
 * sobre ellas se dibujan las zonas anatómicas (cráneo, costillas, pectorales, hígado…). Cada zona se
 * tiñe con el peor nivel entre su sistema (p. ej. huesos) y su región del cuerpo (p. ej. un golpe en el
 * cráneo). El tinte se recorta con la propia figura, así que solo colorea el cuerpo y respeta el dibujo.
 * Lienzo común: 400 × 900, eje del cuerpo en x = 200. Las coordenadas de cada zona son las de su ilustración.
 */
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import {
  NOMBRE_SISTEMA, ORDEN_NIVEL, type EstadoCorporal, type Nivel, type RegionCuerpo, type SistemaCorporal,
} from '../core/tipos';
import { NOMBRE_NIVEL } from './componentes/basicos';
import { useT } from './idioma';

type EstadoVisual = Nivel | 'sinDatos';

export function peorEstado(estado: EstadoCorporal, sistemas: SistemaCorporal[]): EstadoVisual {
  let peor: EstadoVisual = 'sinDatos';
  for (const s of sistemas) {
    const e = estado[s];
    if (e === 'sinDatos') continue;
    if (peor === 'sinDatos' || ORDEN_NIVEL[e] > ORDEN_NIVEL[peor]) peor = e;
  }
  return peor;
}

const peor = (a: EstadoVisual, b: EstadoVisual | undefined): EstadoVisual =>
  !b || b === 'sinDatos' ? a : a === 'sinDatos' || ORDEN_NIVEL[b] > ORDEN_NIVEL[a] ? b : a;

// ── Ilustraciones ──────────────────────────────────────────────────────

type Vista = 'frente' | 'espalda';
export type Categoria = 'organos' | 'musculos' | 'huesos';

const ANCHO = 400;
const ALTO = 900;
const EJE = ANCHO / 2;

/** Archivo de cada categoría (public/cuerpo/<vista>-<archivo>.jpg). */
const ARCHIVO: Record<Categoria, string> = { organos: 'organos', musculos: 'musculos', huesos: 'esqueleto' };

/** Tamaño original y caja de la figura dentro de cada imagen (px). */
const ILUSTRACIONES: Record<Vista, Record<Categoria, { W: number; H: number; caja: [number, number, number, number] }>> = {
  frente: {
    organos: { W: 1408, H: 768, caja: [589, 37, 818, 734] },
    musculos: { W: 1024, H: 572, caja: [428, 25, 595, 538] },
    huesos: { W: 1408, H: 768, caja: [585, 29, 822, 742] },
  },
  espalda: {
    organos: { W: 1024, H: 572, caja: [426, 25, 597, 549] },
    musculos: { W: 1600, H: 871, caja: [634, 37, 1001, 844] },
    huesos: { W: 1280, H: 720, caja: [520, 11, 760, 689] },
  },
};

/** Relativa al documento (la app navega con #), así funciona igual en desarrollo y en un build publicado en otra ruta. */
const ruta = (v: Vista, c: Categoria) => `cuerpo/${v}-${ARCHIVO[c]}.jpg`;

/** Ubica la imagen para que la figura ocupe el lienzo (de y = 20 a y = 880), centrada en el eje. */
function ubicacion(v: Vista, c: Categoria) {
  const il = ILUSTRACIONES[v][c];
  const [x0, y0, x1, y1] = il.caja;
  const s = 860 / (y1 - y0);
  return { x: EJE - ((x0 + x1) / 2) * s, y: 20 - y0 * s, width: il.W * s, height: il.H * s };
}

// ── Zonas anatómicas ───────────────────────────────────────────────────

/** Contorno cerrado: vértices [x, y] de la silueta real de cada estructura. */
type Puntos = [number, number][];

interface ZonaFigura {
  id: string;
  nombre: string;
  /** Sistema de salud cuyo estado tiñe la zona (y que se selecciona al hacer clic). */
  sistema: SistemaCorporal;
  /** Región del cuerpo: un hallazgo localizado (p. ej. golpe en el cráneo) también la tiñe. */
  region?: RegionCuerpo;
  formas: Puntos[];
}

/**
 * Curva cerrada con cuadráticas por el punto medio de cada arista: el contorno pasa pegado a los
 * vértices trazados sin sobrepasarlos, así la silueta encaja con el dibujo de la ilustración.
 */
function curva(puntos: Puntos): string {
  const n = puntos.length;
  const medio = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const inicio = medio(puntos[n - 1], puntos[0]);
  let d = `M ${inicio[0]} ${inicio[1]}`;
  for (let i = 0; i < n; i++) {
    const p = puntos[i];
    const m = medio(p, puntos[(i + 1) % n]);
    d += ` Q ${p[0]} ${p[1]} ${m[0]} ${m[1]}`;
  }
  return `${d} Z`;
}

/** Estructura par: el contorno y su espejo respecto al eje del cuerpo. */
const par = (p: Puntos): Puntos[] => [p, p.map(([x, y]) => [2 * EJE - x, y] as [number, number])];

/** Nódulo redondeado (ganglios linfáticos) como contorno vectorial. */
const circulo = (cx: number, cy: number, r: number, n = 12): Puntos =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });

const z = (id: string, nombre: string, sistema: SistemaCorporal, region: RegionCuerpo | undefined, ...formas: Puntos[]): ZonaFigura =>
  ({ id, nombre, sistema, region, formas });

const FO_INTESTINO: Puntos = [
  [150, 352], [200, 343], [250, 344], [262, 352], [260, 380], [258, 410], [255, 440], [240, 458],
  [228, 458], [222, 470], [218, 486], [200, 489], [193, 474], [188, 460], [170, 452], [150, 445],
  [142, 428], [141, 400], [142, 375], [145, 357]
];

const FO_HIGADO: Puntos = [
  [141.4, 317.4], [143.9, 353.1], [159.9, 345.7], [171, 347], [178.4, 334.6], [184.6, 332.2],
  [185.8, 339.6], [179.6, 348.2], [179.6, 361.8], [184.6, 364.2], [184.6, 351.9], [190.7, 343.3],
  [199.4, 344.5], [211.7, 353.1], [227.8, 353.1], [246.3, 342], [254.9, 324.8], [252.4, 307.5],
  [231.5, 296.4], [163.6, 295.2], [148.8, 302.6]
];

const FO_ESTOMAGO: Puntos = [
  [252.4, 307.5], [238.9, 301.3], [222.8, 317.4], [221.6, 327.2], [215.4, 335.9], [188.3, 337.1],
  [180.9, 344.5], [179.6, 361.8], [187, 364.2], [184.6, 351.9], [190.7, 343.3], [217.9, 354.4],
  [237.6, 349.4], [252.4, 332.2]
];

const FO_PULMON_IZQ: Puntos = [
  [204.3, 169.3], [196.9, 169.3], [196.9, 211.2], [190.7, 221.1], [185.8, 216.2], [187, 197.7],
  [182.1, 190.3], [171, 192.7], [150, 217.4], [135.2, 259.4], [136.5, 295.2], [175.9, 284], [184.6, 277.9],
  [182.1, 250.7], [187, 227.3], [192, 222.4], [196.9, 226.1], [196.9, 219.9], [208, 216.2], [204.3, 210]
];

const FO_PULMON_DER: Puntos = [
  [220.4, 190.3], [215.4, 196.4], [214.2, 212.5], [219.1, 231], [227.8, 231], [230.2, 234.7], [229, 240.9],
  [224.1, 242.1], [233.9, 266.8], [232.7, 284], [263.5, 296.4], [268.5, 284], [267.2, 259.4],
  [257.4, 227.3], [243.8, 205.1], [232.7, 194]
];

const FO_CORAZON: Puntos = [
  [209, 210], [221, 209], [233, 215], [241, 226], [242, 240], [238, 256], [232, 272], [233, 286],
  [232, 296], [224, 293], [212, 284], [202, 271], [194, 255], [192, 241], [197, 226], [203, 215]
];

const FO_TRAQUEA: Puntos = [
  [195, 150], [205, 150], [206, 164], [205, 179], [206, 194], [208, 203], [203, 208], [197, 208],
  [192, 203], [194, 194], [195, 179], [194, 164]
];

const FO_CEREBRO: Puntos = [
  [200, 24], [219, 28], [232, 38], [238, 55], [237, 72], [232, 86], [224, 94], [214, 97], [205, 91],
  [200, 89], [195, 91], [186, 97], [176, 94], [168, 86], [163, 72], [162, 55], [168, 38], [181, 28]
];

const FO_OREJA: Puntos = [
  [153, 82], [160, 86], [162, 96], [160, 107], [154, 113], [149, 106], [149, 94]
];

const FO_OJO: Puntos = [
  [175, 88], [180, 84], [187, 84], [192, 87], [188, 92], [181, 92]
];

const EO_INTESTINO: Puntos = [
  [132, 340], [145, 330], [162, 325], [180, 326], [200, 328], [220, 327], [238, 331], [252, 340],
  [260, 352], [264, 366], [266, 382], [266, 398], [264, 414], [260, 428], [252, 440], [242, 450],
  [230, 458], [220, 466], [210, 472], [200, 474], [190, 472], [180, 466], [170, 458], [158, 450],
  [148, 440], [140, 428], [134, 414], [130, 398], [128, 382], [128, 366], [129, 352]
];

const EO_PULMON_IZQ: Puntos = [
  [200, 166], [186, 170], [170, 182], [153, 198], [140, 220], [132, 248], [130, 272], [134, 291],
  [148, 299], [166, 298], [180, 291], [188, 280], [187, 262], [190, 244], [195, 228], [199, 212],
  [200, 195]
];

const EO_PULMON_DER: Puntos = [
  [200, 166], [214, 170], [230, 182], [247, 198], [260, 220], [268, 248], [270, 272], [266, 291],
  [252, 299], [234, 298], [220, 291], [212, 280], [213, 262], [210, 244], [205, 228], [201, 212],
  [200, 195]
];

const EO_RINON: Puntos = [
  [181, 308], [173, 304], [164, 306], [157, 314], [154, 326], [156, 340], [162, 352], [171, 358],
  [178, 355], [182, 346], [180, 336], [184, 326], [186, 316]
];

const EO_TRAQUEA: Puntos = [
  [195, 155], [205, 155], [206, 168], [205, 181], [206, 194], [208, 203], [203, 208], [197, 208],
  [192, 203], [194, 194], [195, 181], [194, 168]
];

const EO_CEREBRO: Puntos = [
  [200, 18], [220, 22], [233, 33], [238, 50], [237, 68], [232, 84], [224, 93], [213, 97], [205, 93],
  [200, 91], [195, 93], [187, 97], [176, 93], [168, 84], [163, 68], [162, 50], [167, 33], [180, 22]
];

const EO_OREJA: Puntos = [
  [152, 88], [159, 92], [162, 101], [160, 112], [154, 119], [149, 112], [148, 100]
];

const FM_CUELLO: Puntos = [
  [187, 136], [213, 136], [220, 152], [225, 170], [222, 183], [214, 188], [200, 190], [186, 188],
  [178, 183], [175, 170], [180, 152]
];

const FM_PECTORAL: Puntos = [
  [110, 202], [125, 189], [142, 182], [160, 184], [180, 194], [196, 205], [198, 230], [197, 256],
  [196, 274], [180, 276], [162, 274], [146, 269], [132, 260], [118, 245], [110, 226]
];

const FM_ABDOMINALES: Puntos = [
  [200, 271], [220, 276], [229, 292], [232, 320], [232, 352], [229, 380], [220, 400], [207, 406],
  [193, 406], [180, 400], [171, 380], [168, 352], [168, 320], [171, 292], [180, 276]
];

const FM_BICEPS: Puntos = [
  [104, 244], [113, 252], [112, 272], [108, 295], [100, 318], [90, 338], [80, 347], [70, 343], [76, 326],
  [79, 304], [81, 280], [86, 258], [94, 246]
];

const FM_ANTEBRAZO: Puntos = [
  [81, 348], [94, 356], [90, 376], [84, 400], [78, 424], [70, 446], [60, 458], [53, 453], [59, 432],
  [64, 408], [68, 384], [71, 362], [74, 350]
];

const FM_DELTOIDES: Puntos = [
  [94, 182], [110, 185], [120, 198], [122, 217], [118, 236], [109, 248], [97, 254], [85, 249], [76, 236],
  [72, 218], [73, 200], [80, 187]
];

const FM_CUADRICEPS: Puntos = [
  [126, 462], [140, 456], [158, 456], [174, 463], [184, 474], [186, 478], [188, 494], [190, 510],
  [191, 528], [187, 548], [183, 568], [179, 588], [176, 608], [174, 624], [172, 638], [166, 650],
  [156, 656], [144, 655], [134, 648], [128, 638], [124, 626], [122, 612], [120, 596], [116, 578],
  [112, 558], [110, 538], [110, 520], [112, 502], [116, 486], [122, 472]
];

const FM_PIERNA: Puntos = [
  [120, 662], [136, 657], [150, 658], [163, 668], [167, 682], [168, 698], [166, 714], [163, 730],
  [160, 746], [156, 762], [152, 778], [148, 792], [145, 806], [142, 816], [136, 822], [130, 818],
  [127, 806], [126, 792], [124, 778], [122, 764], [120, 750], [117, 736], [115, 722], [114, 708],
  [115, 694], [117, 680]
];

const EM_TRAPECIO: Puntos = [
  [200, 138], [218, 146], [240, 168], [264, 192], [275, 214], [267, 232], [245, 258], [225, 292],
  [210, 330], [200, 365], [190, 330], [175, 292], [155, 258], [133, 232], [125, 214], [136, 192],
  [160, 168], [182, 146]
];

const EM_DORSAL: Puntos = [
  [125, 245], [155, 255], [185, 268], [195, 285], [195, 380], [188, 398], [172, 402], [155, 390],
  [140, 370], [130, 345], [122, 315], [120, 285]
];

const EM_TRICEPS: Puntos = [
  [103, 225], [115, 235], [112, 260], [105, 285], [98, 310], [88, 335], [78, 352], [68, 357], [60, 348],
  [68, 330], [74, 308], [78, 282], [82, 258], [88, 238], [95, 228]
];

const EM_ANTEBRAZO: Puntos = [
  [72, 352], [84, 360], [80, 382], [74, 405], [68, 428], [62, 450], [55, 462], [47, 458], [52, 440],
  [56, 418], [60, 396], [64, 374], [66, 358]
];

const EM_DELTOIDES: Puntos = [
  [96, 178], [114, 183], [124, 198], [126, 218], [120, 238], [110, 250], [97, 255], [84, 250], [73, 236],
  [68, 216], [71, 196], [80, 183]
];

const EM_GLUTEO: Puntos = [
  [126, 392], [146, 386], [168, 388], [185, 394], [194, 403], [197, 416], [195, 432], [191, 450],
  [186, 468], [179, 484], [169, 496], [157, 502], [145, 500], [134, 492], [126, 480], [120, 466],
  [116, 452], [114, 438], [116, 424], [120, 408]
];

const EM_ISQUIOTIBIAL: Puntos = [
  [140, 500], [158, 496], [176, 500], [188, 506], [192, 516], [192, 530], [190, 546], [187, 562],
  [185, 578], [184, 594], [184, 610], [184, 622], [186, 632], [184, 640], [178, 644], [168, 644],
  [157, 640], [147, 634], [139, 626], [132, 618], [126, 608], [121, 596], [117, 584], [114, 572],
  [111, 560], [110, 546], [111, 532], [116, 518], [124, 508], [132, 502]
];

const EM_GEMELO: Puntos = [
  [120, 656], [136, 650], [152, 650], [166, 654], [176, 662], [180, 674], [182, 688], [181, 702],
  [178, 716], [175, 730], [172, 744], [169, 758], [166, 772], [162, 786], [156, 792], [148, 790],
  [140, 782], [134, 772], [130, 760], [127, 746], [124, 732], [121, 718], [118, 704], [115, 690],
  [112, 676], [114, 664]
];

const FH_CRANEO: Puntos = [
  [200, 18], [221, 21], [234, 32], [239, 48], [238, 66], [234, 84], [236, 102], [233, 120], [226, 136],
  [215, 148], [200, 152], [185, 148], [174, 136], [167, 120], [164, 102], [166, 84], [162, 66], [161, 48],
  [166, 32], [179, 21]
];

const FH_CERVICAL: Puntos = [
  [194, 149], [206, 149], [207, 162], [206, 176], [207, 190], [205, 200], [200, 203], [195, 200],
  [193, 190], [194, 176], [193, 162]
];

const FH_CLAVICULA: Puntos = [
  [197, 204], [184, 201], [168, 198], [154, 195], [149, 199], [160, 204], [176, 208], [194, 212]
];

const FH_ESTERNON: Puntos = [
  [194, 204], [206, 204], [207, 216], [206, 232], [205, 252], [206, 272], [204, 290], [202, 305],
  [198, 305], [196, 290], [194, 272], [195, 252], [194, 232], [193, 216]
];

const FH_COSTILLAS: Puntos = [
  [200, 206], [222, 208], [240, 216], [250, 231], [253, 252], [252, 274], [248, 296], [242, 315],
  [232, 329], [218, 336], [200, 331], [182, 336], [168, 329], [158, 315], [152, 296], [148, 274],
  [147, 252], [150, 231], [160, 216], [178, 208]
];

const FH_LUMBAR: Puntos = [
  [194, 320], [206, 320], [207, 334], [206, 348], [207, 362], [206, 376], [203, 390], [197, 390],
  [194, 376], [193, 362], [194, 348], [193, 334]
];

const FH_PELVIS: Puntos = [
  [200, 383], [220, 385], [238, 390], [247, 401], [247, 419], [240, 438], [229, 453], [220, 468],
  [211, 473], [200, 469], [189, 473], [180, 468], [171, 453], [160, 438], [153, 419], [153, 401],
  [162, 390], [180, 385]
];

const FH_HUMERO: Puntos = [
  [98, 196], [92, 206], [88, 220], [82, 240], [78, 260], [74, 280], [70, 300], [66, 320], [60, 340],
  [64, 358], [70, 368], [78, 374], [88, 372], [96, 364], [102, 350], [100, 336], [96, 318], [94, 300],
  [98, 282], [102, 262], [106, 242], [110, 222], [126, 210], [132, 200], [124, 194], [112, 192]
];

const FH_ANTEBRAZO: Puntos = [
  [82, 358], [94, 362], [98, 370], [94, 386], [90, 402], [86, 418], [82, 434], [78, 450], [74, 462],
  [66, 466], [58, 460], [60, 446], [62, 430], [66, 414], [70, 398], [74, 382], [76, 368]
];

const FH_MANO: Puntos = [
  [72, 452], [84, 456], [90, 465], [92, 478], [90, 490], [92, 505], [94, 518], [88, 525], [82, 518],
  [80, 505], [75, 516], [68, 522], [62, 514], [66, 500], [62, 490], [57, 480], [54, 470], [58, 460],
  [64, 454]
];

const FH_FEMUR: Puntos = [
  [124, 452], [124, 465], [125, 480], [126, 495], [127, 510], [128, 525], [129, 540], [130, 555],
  [132, 570], [135, 585], [137, 600], [132, 612], [129, 625], [131, 632], [141, 636], [150, 633],
  [156, 625], [157, 612], [153, 600], [151, 585], [149, 570], [147, 555], [146, 540], [145, 525],
  [144, 510], [143, 495], [145, 480], [149, 465], [152, 452], [146, 447], [136, 446]
];

const FH_RODILLA: Puntos = [
  [116, 626], [129, 618], [144, 621], [155, 632], [158, 645], [152, 658], [140, 666], [126, 663],
  [114, 653], [111, 639]
];

const FH_TIBIA: Puntos = [
  [126, 650], [142, 646], [156, 652], [161, 666], [157, 682], [154, 700], [153, 720], [152, 740],
  [153, 760], [155, 780], [157, 800], [160, 812], [156, 820], [147, 825], [136, 820], [128, 812],
  [124, 800], [123, 780], [123, 760], [124, 740], [125, 720], [126, 700], [125, 680], [126, 664]
];

const FH_PIE: Puntos = [
  [122, 810], [132, 817], [138, 830], [144, 845], [152, 858], [158, 869], [157, 876], [148, 879],
  [133, 878], [116, 875], [103, 869], [96, 862], [99, 854], [109, 849], [115, 840], [117, 828], [119, 815]
];

const EH_CRANEO: Puntos = [
  [200, 16], [222, 20], [235, 32], [240, 50], [239, 70], [235, 88], [230, 104], [222, 115], [212, 120],
  [200, 121], [188, 120], [178, 115], [170, 104], [165, 88], [161, 70], [160, 50], [165, 32], [178, 20]
];

const EH_COLUMNA: Puntos = [
  [191, 118], [209, 118], [210, 150], [209, 182], [210, 214], [209, 246], [210, 278], [211, 306],
  [210, 334], [212, 358], [210, 382], [206, 398], [200, 403], [194, 398], [190, 382], [188, 358],
  [190, 334], [189, 306], [190, 278], [191, 246], [190, 214], [191, 182], [190, 150]
];

const EH_ESCAPULA: Puntos = [
  [146, 147], [166, 148], [181, 155], [186, 163], [185, 178], [182, 193], [177, 204], [168, 209],
  [158, 205], [148, 196], [139, 184], [132, 171], [128, 158], [134, 150]
];

const EH_COSTILLAS: Puntos = [
  [200, 146], [220, 148], [238, 154], [252, 164], [262, 178], [268, 196], [270, 218], [270, 242],
  [268, 264], [262, 286], [254, 304], [243, 318], [230, 327], [216, 331], [200, 328], [184, 331],
  [170, 327], [157, 318], [146, 304], [138, 286], [132, 264], [130, 242], [130, 218], [132, 196],
  [138, 178], [148, 164], [162, 154], [180, 148]
];

const EH_PELVIS: Puntos = [
  [200, 336], [216, 338], [232, 342], [244, 349], [253, 358], [258, 369], [259, 381], [256, 394],
  [250, 407], [242, 418], [232, 427], [222, 433], [213, 430], [208, 422], [200, 417], [192, 422],
  [187, 430], [178, 433], [168, 427], [158, 418], [150, 407], [144, 394], [141, 381], [142, 369],
  [147, 358], [156, 349], [168, 342], [184, 338]
];

const EH_HUMERO: Puntos = [
  [99, 150], [112, 154], [119, 164], [119, 178], [115, 192], [112, 208], [109, 224], [106, 240],
  [103, 256], [100, 272], [95, 286], [90, 296], [98, 302], [108, 304], [107, 311], [98, 314], [87, 310],
  [79, 302], [84, 288], [88, 274], [91, 260], [94, 246], [97, 232], [100, 218], [102, 204], [103, 190],
  [103, 176], [101, 162]
];

const EH_ANTEBRAZO: Puntos = [
  [84, 296], [94, 300], [96, 308], [92, 320], [89, 332], [86, 344], [83, 356], [80, 368], [77, 380],
  [74, 392], [70, 400], [64, 402], [58, 396], [61, 386], [64, 374], [67, 362], [70, 350], [73, 338],
  [76, 326], [79, 314], [80, 304]
];

const EH_MANO: Puntos = [
  [76, 392], [86, 400], [84, 415], [80, 430], [82, 445], [84, 460], [78, 472], [70, 462], [66, 472],
  [60, 468], [62, 452], [56, 442], [52, 430], [54, 418], [60, 404], [68, 396]
];

const EH_FEMUR: Puntos = [
  [146, 401], [156, 402], [162, 405], [169, 403], [176, 407], [181, 414], [182, 423], [178, 430],
  [171, 434], [164, 438], [157, 442], [152, 447], [150, 455], [149, 463], [150, 471], [151, 479],
  [152, 487], [153, 495], [154, 503], [155, 511], [156, 519], [157, 527], [158, 535], [159, 543],
  [160, 551], [161, 559], [163, 567], [166, 575], [170, 582], [174, 590], [176, 598], [177, 605],
  [174, 611], [168, 615], [161, 615], [155, 611], [151, 605], [146, 599], [140, 593], [135, 587],
  [132, 580], [130, 574], [131, 568], [134, 562], [137, 556], [140, 550], [142, 544], [143, 538],
  [144, 532], [143, 526], [142, 520], [141, 514], [140, 508], [140, 502], [139, 496], [139, 490],
  [138, 484], [137, 478], [136, 472], [135, 466], [134, 460], [133, 454], [132, 448], [131, 442],
  [130, 436], [129, 428], [129, 420], [132, 412], [139, 406]
];

const EH_RODILLA: Puntos = [
  [128, 588], [140, 580], [154, 582], [166, 588], [172, 598], [168, 608], [158, 614], [146, 613],
  [135, 608], [128, 598]
];

const EH_TIBIA: Puntos = [
  [126, 618], [142, 612], [156, 612], [168, 616], [172, 624], [168, 632], [162, 638], [158, 646],
  [157, 662], [157, 680], [157, 698], [156, 716], [156, 734], [156, 752], [157, 770], [158, 788],
  [159, 804], [163, 814], [164, 822], [158, 830], [149, 833], [140, 828], [134, 818], [132, 806],
  [130, 790], [128, 774], [126, 758], [124, 742], [122, 726], [120, 710], [119, 694], [118, 678],
  [118, 662], [119, 646], [120, 630]
];

const EH_PIE: Puntos = [
  [138, 822], [151, 822], [159, 828], [164, 838], [168, 848], [171, 856], [172, 865], [169, 873],
  [163, 879], [155, 881], [146, 880], [138, 876], [131, 870], [125, 870], [115, 872], [105, 868],
  [98, 862], [96, 855], [102, 847], [111, 843], [120, 841], [126, 835], [131, 828]
];

/** Orden de dibujo: lo de atrás primero; lo que se dibuja después tiene prioridad al hacer clic. */
const ZONAS: Record<Vista, Record<Categoria, ZonaFigura[]>> = {
  frente: {
    organos: [
      z('intestino', 'Intestinos', 'intestino', 'abdomen', FO_INTESTINO),
      z('higado', 'Hígado', 'metabolismo', 'abdomen', FO_HIGADO),
      z('estomago', 'Estómago', 'intestino', 'abdomen', FO_ESTOMAGO),
      z('pulmones', 'Pulmones', 'pulmones', 'torax', FO_PULMON_IZQ, FO_PULMON_DER),
      z('corazon', 'Corazón', 'corazon', 'torax', FO_CORAZON),
      z('traquea', 'Tráquea', 'pulmones', 'cuello', FO_TRAQUEA),
      z('ganglios', 'Ganglios linfáticos', 'inmune', undefined,
        circulo(184, 157, 7), circulo(216, 157, 7),
        circulo(139, 250, 8), circulo(261, 250, 8),
        circulo(178, 462, 8), circulo(222, 462, 8)),
      z('cerebro', 'Cerebro', 'cerebro', 'craneo', FO_CEREBRO),
      z('oido', 'Oído interno', 'oidoInterno', 'craneo', ...par(FO_OREJA)),
      z('ojos', 'Ojos', 'ojos', 'cara', ...par(FO_OJO)),
    ],
    musculos: [
      z('cuello-m', 'Cuello', 'musculos', 'cuello', FM_CUELLO),
      z('pectorales', 'Pectorales', 'musculos', 'torax', ...par(FM_PECTORAL)),
      z('abdominales', 'Abdominales', 'musculos', 'abdomen', FM_ABDOMINALES),
      z('biceps', 'Brazos (bíceps)', 'musculos', 'brazos', ...par(FM_BICEPS)),
      z('antebrazos-m', 'Antebrazos', 'musculos', 'brazos', ...par(FM_ANTEBRAZO)),
      z('deltoides', 'Hombros (deltoides)', 'musculos', 'brazos', ...par(FM_DELTOIDES)),
      z('cuadriceps', 'Muslos (cuádriceps)', 'piernas', 'piernas', ...par(FM_CUADRICEPS)),
      z('piernas-m', 'Piernas (tibial y gemelos)', 'piernas', 'piernas', ...par(FM_PIERNA)),
    ],
    huesos: [
      z('costillas', 'Costillas', 'huesos', 'torax', FH_COSTILLAS),
      z('esternon', 'Esternón', 'huesos', 'torax', FH_ESTERNON),
      z('claviculas', 'Clavículas', 'huesos', 'torax', ...par(FH_CLAVICULA)),
      z('cervical', 'Columna cervical', 'huesos', 'cuello', FH_CERVICAL),
      z('lumbar', 'Columna lumbar', 'huesos', 'columna', FH_LUMBAR),
      z('pelvis', 'Pelvis', 'huesos', 'pelvis', FH_PELVIS),
      z('humeros', 'Húmeros', 'huesos', 'brazos', ...par(FH_HUMERO)),
      z('antebrazos-h', 'Radio y cúbito', 'huesos', 'brazos', ...par(FH_ANTEBRAZO)),
      z('manos', 'Manos', 'huesos', 'brazos', ...par(FH_MANO)),
      z('femures', 'Fémures', 'huesos', 'piernas', ...par(FH_FEMUR)),
      z('rodillas', 'Rodillas', 'huesos', 'piernas', ...par(FH_RODILLA)),
      z('tibias', 'Tibias y peronés', 'huesos', 'piernas', ...par(FH_TIBIA)),
      z('pies', 'Pies', 'huesos', 'piernas', ...par(FH_PIE)),
      z('craneo', 'Cráneo', 'huesos', 'craneo', FH_CRANEO),
    ],
  },
  espalda: {
    organos: [
      z('intestino', 'Intestinos', 'intestino', 'abdomen', EO_INTESTINO),
      z('pulmones', 'Pulmones', 'pulmones', 'torax', EO_PULMON_IZQ, EO_PULMON_DER),
      z('rinones', 'Riñones', 'metabolismo', 'abdomen', ...par(EO_RINON)),
      z('traquea', 'Tráquea', 'pulmones', 'cuello', EO_TRAQUEA),
      z('ganglios', 'Ganglios linfáticos', 'inmune', undefined, ...par(circulo(184, 155, 7))),
      z('cerebro', 'Cerebro', 'cerebro', 'craneo', EO_CEREBRO),
      z('oido', 'Oído interno', 'oidoInterno', 'craneo', ...par(EO_OREJA)),
    ],
    musculos: [
      z('trapecio', 'Trapecio', 'musculos', 'cuello', EM_TRAPECIO),
      z('dorsales', 'Dorsales', 'musculos', 'torax', ...par(EM_DORSAL)),
      z('triceps', 'Brazos (tríceps)', 'musculos', 'brazos', ...par(EM_TRICEPS)),
      z('antebrazos-m', 'Antebrazos', 'musculos', 'brazos', ...par(EM_ANTEBRAZO)),
      z('deltoides', 'Hombros (deltoides)', 'musculos', 'brazos', ...par(EM_DELTOIDES)),
      z('gluteos', 'Glúteos', 'piernas', 'pelvis', ...par(EM_GLUTEO)),
      z('isquiotibiales', 'Muslos (isquiotibiales)', 'piernas', 'piernas', ...par(EM_ISQUIOTIBIAL)),
      z('gemelos', 'Gemelos', 'piernas', 'piernas', ...par(EM_GEMELO)),
    ],
    huesos: [
      z('costillas', 'Costillas', 'huesos', 'torax', EH_COSTILLAS),
      z('escapulas', 'Escápulas', 'huesos', 'torax', ...par(EH_ESCAPULA)),
      z('columna', 'Columna vertebral', 'huesos', 'columna', EH_COLUMNA),
      z('pelvis', 'Pelvis y sacro', 'huesos', 'pelvis', EH_PELVIS),
      z('humeros', 'Húmeros', 'huesos', 'brazos', ...par(EH_HUMERO)),
      z('antebrazos-h', 'Radio y cúbito', 'huesos', 'brazos', ...par(EH_ANTEBRAZO)),
      z('manos', 'Manos', 'huesos', 'brazos', ...par(EH_MANO)),
      z('femures', 'Fémures', 'huesos', 'piernas', ...par(EH_FEMUR)),
      z('rodillas', 'Rodillas', 'huesos', 'piernas', ...par(EH_RODILLA)),
      z('tibias', 'Tibias y peronés', 'huesos', 'piernas', ...par(EH_TIBIA)),
      z('pies', 'Pies', 'huesos', 'piernas', ...par(EH_PIE)),
      z('craneo', 'Cráneo', 'huesos', 'craneo', EH_CRANEO),
    ],
  },
};

const VISTAS: [Vista, string][] = [['frente', 'Frente'], ['espalda', 'Espalda']];
export const CATEGORIAS: [Categoria, string][] = [['organos', 'Órganos'], ['musculos', 'Músculos'], ['huesos', 'Huesos']];

/** Dónde mostrar un sistema: primero la vista y categoría actuales, luego las demás. */
function ubicarSistema(s: SistemaCorporal, vista: Vista, categoria: Categoria): { vista: Vista; categoria: Categoria } | null {
  const vistas: Vista[] = [vista, vista === 'frente' ? 'espalda' : 'frente'];
  const categorias: Categoria[] = [categoria, ...(['organos', 'musculos', 'huesos'] as Categoria[]).filter((c) => c !== categoria)];
  for (const c of categorias) for (const v of vistas) if (ZONAS[v][c].some((zona) => zona.sistema === s)) return { vista: v, categoria: c };
  return null;
}

// ── Componente ─────────────────────────────────────────────────────────

interface Props {
  estado: EstadoCorporal;
  /** Peor nivel por región del cuerpo (hallazgos localizados, p. ej. golpe en el cráneo). */
  regiones?: Partial<Record<RegionCuerpo, Nivel>>;
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (sistemas: SistemaCorporal[]) => void;
}

const CLAVE_VISTA = 'higia.figura';
const leerPreferencia = (): { vista: Vista; categoria: Categoria } => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTA) ?? '{}') as { vista?: Vista; categoria?: Categoria };
    return { vista: v.vista === 'espalda' ? 'espalda' : 'frente', categoria: v.categoria === 'musculos' || v.categoria === 'huesos' ? v.categoria : 'organos' };
  } catch { return { vista: 'frente', categoria: 'organos' }; }
};

export function FiguraCorporal({ estado, regiones = {}, seleccion, onSeleccionar }: Props) {
  const t = useT();
  const [{ vista, categoria }, setPreferencia] = useState(leerPreferencia);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const id = useId().replace(/:/g, '');
  const pos = ubicacion(vista, categoria);
  const zonas = ZONAS[vista][categoria];

  const cambiar = (p: Partial<{ vista: Vista; categoria: Categoria }>) => setPreferencia((prev) => {
    const nuevo = { ...prev, ...p };
    try { localStorage.setItem(CLAVE_VISTA, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
    return nuevo;
  });

  // Precarga las seis ilustraciones para que cambiar de vista o categoría sea instantáneo.
  useEffect(() => {
    for (const v of ['frente', 'espalda'] as Vista[]) for (const c of ['organos', 'musculos', 'huesos'] as Categoria[]) new Image().src = ruta(v, c);
  }, []);

  // Si piden un sistema que no aparece en lo que se ve (p. ej. los huesos con la categoría Órganos), se cambia a donde está.
  useEffect(() => {
    const s = seleccion?.[0];
    if (!s || s === 'cuerpo' || zonas.some((zona) => zona.sistema === s)) return;
    const destino = ubicarSistema(s, vista, categoria);
    if (destino) cambiar(destino);
  }, [seleccion]); // eslint-disable-line react-hooks/exhaustive-deps

  const nivelZona = (zona: ZonaFigura): EstadoVisual => peor(peorEstado(estado, [zona.sistema]), zona.region ? regiones[zona.region] : undefined);
  const etiqueta = (zona: ZonaFigura) => `${t(zona.nombre)} · ${t(NOMBRE_SISTEMA[zona.sistema])}: ${t(NOMBRE_NIVEL[nivelZona(zona)])}`;
  // Si se tocó una zona, se resalta solo esa; si el sistema se eligió desde la lista, todas sus zonas.
  const activa = zonas.find((x) => x.id === zonaActiva && seleccion?.includes(x.sistema));
  const elegida = (zona: ZonaFigura) => (activa ? zona.id === activa.id : !!seleccion?.includes(zona.sistema));
  const elegir = (zona: ZonaFigura) => { setZonaActiva(zona.id); onSeleccionar([zona.sistema]); };
  const alTeclear = (f: () => void) => (ev: KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); f(); } };

  const nivelCuerpo = peorEstado(estado, ['cuerpo']);

  const formas = (zona: ZonaFigura) => zona.formas.map((f, i) => <path key={i} d={curva(f)} />);

  const imagen = (filtro: string) => <image href={ruta(vista, categoria)} {...pos} preserveAspectRatio="none" filter={`url(#${filtro})`} />;

  return (
    <div className="figura">
      <div className="figura-controles">
        <div className="figura-selector" role="group" aria-label={t('Qué mostrar')}>
          {CATEGORIAS.map(([c, n]) => <button key={c} aria-pressed={categoria === c} onClick={() => cambiar({ categoria: c })}>{t(n)}</button>)}
        </div>
        <div className="figura-selector" role="group" aria-label={t('Vista')}>
          {VISTAS.map(([v, n]) => <button key={v} aria-pressed={vista === v} onClick={() => cambiar({ vista: v })}>{t(n)}</button>)}
        </div>
      </div>

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="figura-svg" aria-label={`${t('Figura anatómica')}: ${t(CATEGORIAS.find(([c]) => c === categoria)![1]).toLowerCase()}, ${t('vista de {vista}', { vista: t(vista) })}`}>
        <defs>
          {/* Luminancia → transparencia: quita el fondo oscuro y deja la figura en un blanco azulado del tema. */}
          <filter id={`${id}-figura`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0.87  0 0 0 0 0.91  0 0 0 0 1  0.404 1.359 0.137 0 -0.57" />
            {/* Curva sobre la transparencia: borra los grises tenues del piso sin afectar la figura. */}
            <feComponentTransfer><feFuncA type="gamma" amplitude={1} exponent={2.2} offset={0} /></feComponentTransfer>
          </filter>
          <mask id={`${id}-mascara`} maskUnits="userSpaceOnUse" x={0} y={0} width={ANCHO} height={ALTO}>
            {imagen(`${id}-figura`)}
          </mask>
        </defs>

        {/* Todo el cuerpo (radiación): el halo de la figura toma su color. */}
        <g
          className={`sistema-svg nivel-${nivelCuerpo} aura-cuerpo ${seleccion?.includes('cuerpo') ? 'seleccionado' : ''}`}
          role="button" tabIndex={0} aria-label={`${t('Todo el cuerpo (radiación)')}: ${t(NOMBRE_NIVEL[nivelCuerpo])}`}
          aria-pressed={!!seleccion?.includes('cuerpo')} onClick={() => { setZonaActiva(null); onSeleccionar(['cuerpo']); }}
          onKeyDown={alTeclear(() => { setZonaActiva(null); onSeleccionar(['cuerpo']); })}
        >
          <title>{`${t('Todo el cuerpo (radiación)')}: ${t(NOMBRE_NIVEL[nivelCuerpo])}`}</title>
          {imagen(`${id}-figura`)}
        </g>

        {/* Tinte por zona, recortado con la figura. */}
        <g mask={`url(#${id}-mascara)`} className="tintes" aria-hidden>
          {zonas.map((zona) => (
            <g key={zona.id} className={`tinte sistema-svg nivel-${nivelZona(zona)} ${elegida(zona) ? 'seleccionado' : ''}`}>{formas(zona)}</g>
          ))}
        </g>

        {/* Zonas interactivas (invisibles salvo el contorno al pasar o seleccionar). */}
        <g className="zonas">
          {zonas.map((zona) => (
            <g
              key={zona.id} className={`zona-sistema sistema-svg nivel-${nivelZona(zona)} ${elegida(zona) ? 'seleccionado' : ''}`}
              role="button" tabIndex={0} aria-label={etiqueta(zona)} aria-pressed={elegida(zona)}
              onClick={() => elegir(zona)} onKeyDown={alTeclear(() => elegir(zona))}
            >
              <title>{etiqueta(zona)}</title>
              {formas(zona)}
            </g>
          ))}
        </g>
      </svg>

      <p className="figura-zona" aria-live="polite">
        {activa ? <><strong>{t(activa.nombre)}</strong> · {t(NOMBRE_SISTEMA[activa.sistema])}: {t(NOMBRE_NIVEL[nivelZona(activa)])}</> : t('Pasa el mouse o usa Tab para ver cada zona · clic o Enter para ver su detalle')}
      </p>
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className={`punto nivel-${n}`} />{t(NOMBRE_NIVEL[n])}</li>
        ))}
      </ul>
    </div>
  );
}
