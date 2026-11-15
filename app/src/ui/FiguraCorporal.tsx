/**
 * FIGURA ANATÓMICA 2D — el cuerpo clasificado por sistemas (respiratorio, circulatorio, digestivo,
 * urinario, nervioso, endocrino, inmune, muscular, óseo) y vista (frente, espalda). En cada sistema
 * solo aparece lo suyo:
 *
 * - Sistemas de órganos: la silueta del cuerpo (sacada de la ilustración, sin sus órganos) y encima
 *   solo los órganos del sistema elegido, dibujados en SVG (`anatomia.ts`).
 * - Muscular y óseo: la ilustración de músculos o huesos con sus zonas, como antes.
 * - Inmune: no tiene un lugar en la figura; se muestran sus métricas (`MetricasInmunes`).
 *
 * Cada órgano o zona se tiñe con el peor nivel entre su sistema de salud (p. ej. pulmones) y su región
 * del cuerpo (p. ej. un golpe en el cráneo). Lienzo común: 400 × 900, eje del cuerpo en x = 200.
 */
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import type { Historial } from '../core/historial';
import {
  NOMBRE_SISTEMA, ORDEN_NIVEL, type EstadoCorporal, type Hallazgo, type Nivel, type RegionCuerpo, type SistemaCorporal,
} from '../core/tipos';
import {
  ALTO, ANCHO, EJE, ORDEN_SISTEMAS, ORGANOS, SISTEMAS_ANATOMICOS, curva, linea, par,
  type Organo, type Puntos, type SistemaAnatomico,
} from './anatomia';
import { NOMBRE_NIVEL } from './componentes/basicos';
import { useT } from './idioma';
import { MetricasInmunes } from './MetricasInmunes';

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

export type Vista = 'frente' | 'espalda';
/** Ilustración de fondo: la de órganos solo aporta la silueta; músculos y huesos se muestran completas. */
type Ilustracion = 'organos' | 'musculos' | 'huesos';

/** Archivo de cada ilustración (public/cuerpo/<vista>-<archivo>.jpg). */
const ARCHIVO: Record<Ilustracion, string> = { organos: 'organos', musculos: 'musculos', huesos: 'esqueleto' };

/** Tamaño original y caja de la figura dentro de cada imagen (px). */
const ILUSTRACIONES: Record<Vista, Record<Ilustracion, { W: number; H: number; caja: [number, number, number, number] }>> = {
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

/** Ilustración que usa cada sistema que no se dibuja con órganos vectoriales. */
const ILUSTRACION_DE: Partial<Record<SistemaAnatomico, 'musculos' | 'huesos'>> = { muscular: 'musculos', oseo: 'huesos' };

/** Relativa al documento (la app navega con #), así funciona igual en desarrollo y en un build publicado en otra ruta. */
const ruta = (v: Vista, c: Ilustracion) => `cuerpo/${v}-${ARCHIVO[c]}.jpg`;

/** Ubica la imagen para que la figura ocupe el lienzo (de y = 20 a y = 880), centrada en el eje. */
function ubicacion(v: Vista, c: Ilustracion) {
  const il = ILUSTRACIONES[v][c];
  const [x0, y0, x1, y1] = il.caja;
  const s = 860 / (y1 - y0);
  return { x: EJE - ((x0 + x1) / 2) * s, y: 20 - y0 * s, width: il.W * s, height: il.H * s };
}

// ── Zonas de músculos y huesos (sobre su ilustración) ──────────────────

interface ZonaFigura {
  id: string;
  nombre: string;
  /** Sistema de salud cuyo estado tiñe la zona (y que se selecciona al hacer clic). */
  sistema: SistemaCorporal;
  /** Región del cuerpo: un hallazgo localizado (p. ej. golpe en el cráneo) también la tiñe. */
  region?: RegionCuerpo;
  formas: Puntos[];
}

const z = (id: string, nombre: string, sistema: SistemaCorporal, region: RegionCuerpo | undefined, ...formas: Puntos[]): ZonaFigura =>
  ({ id, nombre, sistema, region, formas });

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
const ZONAS: Record<Vista, Record<'musculos' | 'huesos', ZonaFigura[]>> = {
  frente: {
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

/** Órganos de un sistema tal como se ven: de espalda se quitan los que solo se ven de frente y se invierte el orden. */
function organosVisibles(s: SistemaAnatomico, vista: Vista): Organo[] {
  const lista = ORGANOS[s] ?? [];
  return vista === 'frente' ? lista : lista.filter((x) => !x.soloFrente).reverse();
}

/** ¿El sistema anatómico muestra algo del sistema de salud `s`? */
function muestra(a: SistemaAnatomico, s: SistemaCorporal): boolean {
  const info = SISTEMAS_ANATOMICOS[a];
  if (info.modo === 'metricas') return s === 'inmune';
  if (info.modo === 'organos') return (ORGANOS[a] ?? []).some((x) => x.sistema === s);
  const il = ILUSTRACION_DE[a]!;
  return ZONAS.frente[il].some((x) => x.sistema === s) || ZONAS.espalda[il].some((x) => x.sistema === s);
}

/** Sistema anatómico donde ver un sistema de salud: el actual si lo muestra; si no, el primero que lo tenga. */
export function ubicarSistema(s: SistemaCorporal, actual: SistemaAnatomico): SistemaAnatomico | null {
  if (s === 'cuerpo' || muestra(actual, s)) return null;
  return ORDEN_SISTEMAS.find((a) => muestra(a, s)) ?? null;
}

// ── Componente ─────────────────────────────────────────────────────────

interface Props {
  estado: EstadoCorporal;
  /** Peor nivel por región del cuerpo (hallazgos localizados, p. ej. golpe en el cráneo). */
  regiones?: Partial<Record<RegionCuerpo, Nivel>>;
  /** Lecturas de los sensores: alimentan las métricas de los sistemas que no se ven en la figura. */
  historial?: Historial;
  hallazgos?: Hallazgo[];
  seleccion: SistemaCorporal[] | null;
  onSeleccionar: (sistemas: SistemaCorporal[]) => void;
}

interface Preferencia { vista: Vista; sistema: SistemaAnatomico }

const CLAVE_VISTA = 'higia.figura';
const POR_DEFECTO: Preferencia = { vista: 'frente', sistema: 'respiratorio' };
const leerPreferencia = (): Preferencia => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTA) ?? '{}') as { vista?: Vista; sistema?: string; categoria?: string };
    const vista: Vista = v.vista === 'espalda' ? 'espalda' : 'frente';
    // Preferencias guardadas antes de la clasificación por sistemas: músculos → muscular, huesos → óseo.
    const antigua = v.categoria === 'musculos' ? 'muscular' : v.categoria === 'huesos' ? 'oseo' : undefined;
    const pedido = v.sistema ?? antigua;
    const sistema = pedido && pedido in SISTEMAS_ANATOMICOS ? (pedido as SistemaAnatomico) : POR_DEFECTO.sistema;
    return { vista, sistema };
  } catch { return POR_DEFECTO; }
};

/** Lo que tienen en común un órgano y una zona: se pueden elegir y se tiñen igual. */
type Pieza = Pick<ZonaFigura, 'id' | 'nombre' | 'sistema' | 'region'>;

export function FiguraCorporal({ estado, regiones = {}, historial, hallazgos = [], seleccion, onSeleccionar }: Props) {
  const t = useT();
  const [{ vista, sistema }, setPreferencia] = useState(leerPreferencia);
  const [piezaActiva, setPiezaActiva] = useState<string | null>(null);
  const id = useId().replace(/:/g, '');
  const info = SISTEMAS_ANATOMICOS[sistema];
  /** «sistema respiratorio» / «respiratory system». */
  const nombreSistema = t('Sistema {nombre}', { nombre: t(info.nombre).toLowerCase() }).toLowerCase();
  const ilustracion: Ilustracion = ILUSTRACION_DE[sistema] ?? 'organos';
  const pos = ubicacion(vista, ilustracion);
  const zonas = info.modo === 'ilustracion' ? ZONAS[vista][ilustracion as 'musculos' | 'huesos'] : [];
  const organos = info.modo === 'organos' ? organosVisibles(sistema, vista) : [];
  const piezas: Pieza[] = [...zonas, ...organos];

  const cambiar = (p: Partial<Preferencia>) => setPreferencia((prev) => {
    const nuevo = { ...prev, ...p };
    try { localStorage.setItem(CLAVE_VISTA, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
    return nuevo;
  });

  // Precarga las ilustraciones para que cambiar de vista o sistema sea instantáneo.
  useEffect(() => {
    for (const v of ['frente', 'espalda'] as Vista[]) for (const c of ['organos', 'musculos', 'huesos'] as Ilustracion[]) new Image().src = ruta(v, c);
  }, []);

  // Si piden un sistema de salud que no aparece en lo que se ve (p. ej. el corazón con Digestivo), se cambia a donde está.
  useEffect(() => {
    const s = seleccion?.[0];
    if (!s) return;
    const destino = ubicarSistema(s, sistema);
    if (destino) cambiar({ sistema: destino });
  }, [seleccion]); // eslint-disable-line react-hooks/exhaustive-deps

  const nivelPieza = (p: Pieza): EstadoVisual => peor(peorEstado(estado, [p.sistema]), p.region ? regiones[p.region] : undefined);
  const etiqueta = (p: Pieza) => `${t(p.nombre)} · ${t(NOMBRE_SISTEMA[p.sistema])}: ${t(NOMBRE_NIVEL[nivelPieza(p)])}`;
  // Si se tocó una pieza, se resalta solo esa; si el sistema se eligió desde la lista, todas las suyas.
  const activa = piezas.find((x) => x.id === piezaActiva && seleccion?.includes(x.sistema));
  const elegida = (p: Pieza) => (activa ? p.id === activa.id : !!seleccion?.includes(p.sistema));
  const elegir = (p: Pieza) => { setPiezaActiva(p.id); onSeleccionar([p.sistema]); };
  const alTeclear = (f: () => void) => (ev: KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); f(); } };
  const interactiva = (p: Pieza) => ({
    role: 'button', tabIndex: 0, 'aria-label': etiqueta(p), 'aria-pressed': elegida(p),
    onClick: () => elegir(p), onKeyDown: alTeclear(() => elegir(p)),
  });

  const nivelCuerpo = peorEstado(estado, ['cuerpo']);
  const elegirCuerpo = () => { setPiezaActiva(null); onSeleccionar(['cuerpo']); };

  const formas = (zona: ZonaFigura) => zona.formas.map((f, i) => <path key={i} d={curva(f)} />);
  const imagen = (filtro: string) => <image href={ruta(vista, ilustracion)} {...pos} preserveAspectRatio="none" filter={`url(#${filtro})`} />;

  const selectorSistemas = (
    <div className="figura-sistemas" role="group" aria-label={t('Sistema del cuerpo')}>
      {ORDEN_SISTEMAS.map((s) => (
        <button key={s} aria-pressed={sistema === s} onClick={() => { setPiezaActiva(null); cambiar({ sistema: s }); }}>
          {t(SISTEMAS_ANATOMICOS[s].nombre)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="figura">
      <div className="figura-controles">
        {selectorSistemas}
        <p className="figura-sistema-desc">
          <strong>{nombreSistema.charAt(0).toUpperCase() + nombreSistema.slice(1)}</strong> · {t(info.descripcion)}
        </p>
        {info.modo !== 'metricas' && (
          <div className="figura-selector" role="group" aria-label={t('Vista')}>
            {VISTAS.map(([v, n]) => <button key={v} aria-pressed={vista === v} onClick={() => cambiar({ vista: v })}>{t(n)}</button>)}
          </div>
        )}
      </div>

      {info.modo === 'metricas' ? (
        <MetricasInmunes
          nivel={estado.inmune} historial={historial} hallazgos={hallazgos.filter((h) => h.sistema === 'inmune')}
          seleccionado={!!seleccion?.includes('inmune')} onSeleccionar={() => onSeleccionar(['inmune'])}
        />
      ) : (
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="figura-svg" aria-label={`${t('Figura anatómica')}: ${nombreSistema}, ${t('vista de {vista}', { vista: t(vista) })}`}>
          <defs>
            {/* Luminancia → transparencia: quita el fondo oscuro y deja la figura en un blanco azulado del tema. */}
            <filter id={`${id}-figura`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0 0 0 0 0.87  0 0 0 0 0.91  0 0 0 0 1  0.404 1.359 0.137 0 -0.57" />
              {/* Curva sobre la transparencia: borra los grises tenues del piso sin afectar la figura. */}
              <feComponentTransfer><feFuncA type="gamma" amplitude={1} exponent={2.2} offset={0} /></feComponentTransfer>
            </filter>
            {/*
              Silueta sin órganos: la misma luminancia, umbral a blanco/negro y un cierre (dilatar y erosionar)
              que rellena las líneas finas de los órganos dibujados. Queda un cuerpo translúcido con su borde.
            */}
            <filter id={`${id}-silueta`} colorInterpolationFilters="sRGB" x="-5%" y="-3%" width="110%" height="106%">
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.404 1.359 0.137 0 -0.57" />
              <feComponentTransfer><feFuncA type="discrete" tableValues="0 1" /></feComponentTransfer>
              <feMorphology operator="dilate" radius={5} />
              <feMorphology operator="erode" radius={5} />
              {/* Desenfoque y nuevo contraste: borde suave en lugar de escalonado. */}
              <feGaussianBlur stdDeviation={1.3} result="suave" />
              <feComponentTransfer in="suave" result="silueta"><feFuncA type="linear" slope={3} intercept={-1} /></feComponentTransfer>
              {/* El borde es la franja donde la transparencia pasa por la mitad. */}
              <feComponentTransfer in="suave" result="borde"><feFuncA type="table" tableValues="0 0.55 1 0.55 0" /></feComponentTransfer>
              <feFlood floodColor="#c9d6ff" floodOpacity={0.09} />
              <feComposite in2="silueta" operator="in" result="relleno" />
              <feFlood floodColor="#c9d6ff" floodOpacity={0.6} />
              <feComposite in2="borde" operator="in" result="linea" />
              <feMerge><feMergeNode in="relleno" /><feMergeNode in="linea" /></feMerge>
            </filter>
            <mask id={`${id}-mascara`} maskUnits="userSpaceOnUse" x={0} y={0} width={ANCHO} height={ALTO}>
              {imagen(`${id}-figura`)}
            </mask>
          </defs>

          {/* Todo el cuerpo (radiación): el halo de la figura toma su color. */}
          <g
            className={`sistema-svg nivel-${nivelCuerpo} aura-cuerpo ${info.modo === 'organos' ? 'aura-silueta' : ''} ${seleccion?.includes('cuerpo') ? 'seleccionado' : ''}`}
            role="button" tabIndex={0} aria-label={`${t('Todo el cuerpo (radiación)')}: ${t(NOMBRE_NIVEL[nivelCuerpo])}`}
            aria-pressed={!!seleccion?.includes('cuerpo')} onClick={elegirCuerpo} onKeyDown={alTeclear(elegirCuerpo)}
          >
            <title>{`${t('Todo el cuerpo (radiación)')}: ${t(NOMBRE_NIVEL[nivelCuerpo])}`}</title>
            {imagen(info.modo === 'organos' ? `${id}-silueta` : `${id}-figura`)}
          </g>

          {info.modo === 'ilustracion' && (
            <>
              {/* Tinte por zona, recortado con la figura. */}
              <g mask={`url(#${id}-mascara)`} className="tintes" aria-hidden>
                {zonas.map((zona) => (
                  <g key={zona.id} className={`tinte sistema-svg nivel-${nivelPieza(zona)} ${elegida(zona) ? 'seleccionado' : ''}`}>{formas(zona)}</g>
                ))}
              </g>

              {/* Zonas interactivas (invisibles salvo el contorno al pasar o seleccionar). */}
              <g className="zonas">
                {zonas.map((zona) => (
                  <g key={zona.id} className={`zona-sistema sistema-svg nivel-${nivelPieza(zona)} ${elegida(zona) ? 'seleccionado' : ''}`} {...interactiva(zona)}>
                    <title>{etiqueta(zona)}</title>
                    {formas(zona)}
                  </g>
                ))}
              </g>
            </>
          )}

          {info.modo === 'organos' && (
            // De espalda se ven los mismos órganos en espejo.
            <g className="organos" transform={vista === 'espalda' ? `translate(${ANCHO} 0) scale(-1 1)` : undefined}>
              {organos.map((org) => (
                <g
                  key={org.id}
                  className={`organo sistema-svg nivel-${nivelPieza(org)} ${org.tenue ? 'tenue' : ''} ${elegida(org) ? 'seleccionado' : ''}`}
                  {...interactiva(org)}
                >
                  <title>{etiqueta(org)}</title>
                  {org.formas.map((f, i) => <path key={`h${i}`} className="organo-toque" d={curva(f)} />)}
                  {org.formas.map((f, i) => <path key={`f${i}`} className="organo-forma" d={curva(f)} />)}
                  {org.trazos?.map((t, i) => <path key={`t${i}`} className="organo-trazo" d={linea(t)} />)}
                </g>
              ))}
            </g>
          )}
        </svg>
      )}

      {info.modo !== 'metricas' && (
        <p className="figura-zona" aria-live="polite">
          {activa
            ? <><strong>{t(activa.nombre)}</strong> · {t(NOMBRE_SISTEMA[activa.sistema])}: {t(NOMBRE_NIVEL[nivelPieza(activa)])}</>
            : t('Pasa el mouse o usa Tab para ver cada órgano · clic o Enter para ver su detalle')}
        </p>
      )}
      <ul className="leyenda">
        {(['normal', 'info', 'aviso', 'alerta', 'sinDatos'] as EstadoVisual[]).map((n) => (
          <li key={n}><span className={`punto nivel-${n}`} />{t(NOMBRE_NIVEL[n])}</li>
        ))}
      </ul>
    </div>
  );
}
