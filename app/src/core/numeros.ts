/**
 * Números en palabras → cifras, para el intérprete local ("treinta y ocho coma dos" → "38.2").
 * Recibe texto ya normalizado (minúsculas, sin tildes). Cubre de cero a 9999, decimales con
 * "coma" o "punto", y "y medio" / "y media".
 */

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

/** "Un", "una" y "uno" solo son números delante de una unidad ("una hora"), no en "un poco" o "una ampolla". */
const UNIDAD_MEDIDA = /^(horas?|litros?|kilos?|minutos?|vasos?|mil|grados?|noches?|dias?)$/;

const esPalabraNumero = (t: string) => t in UNIDADES || t in DECENAS || t in CENTENAS || t === 'mil';

/** Lee un entero de 0 a 9999 desde `ts[i]`. Devuelve el valor y cuántos tokens consumió. */
function entero(ts: string[], i: number): { valor: number; usados: number } | null {
  let j = i;
  let total = 0;
  let actual = 0;
  let leyo = false;
  while (j < ts.length) {
    const t = ts[j];
    if (t in CENTENAS) { actual += CENTENAS[t]; leyo = true; j++; continue; }
    if (t in DECENAS) {
      actual += DECENAS[t]; leyo = true; j++;
      // "treinta y ocho"
      if (ts[j] === 'y' && ts[j + 1] in UNIDADES && UNIDADES[ts[j + 1]] < 10) { actual += UNIDADES[ts[j + 1]]; j += 2; }
      continue;
    }
    if (t in UNIDADES) {
      if ((t === 'un' || t === 'una' || t === 'uno') && !leyo && !UNIDAD_MEDIDA.test(ts[j + 1] ?? '')) break;
      actual += UNIDADES[t]; leyo = true; j++; continue;
    }
    if (t === 'mil') { total += (actual || 1) * 1000; actual = 0; leyo = true; j++; continue; }
    break;
  }
  return leyo ? { valor: total + actual, usados: j - i } : null;
}

/** Reemplaza los números escritos en palabras por cifras. */
export function palabrasANumeros(texto: string): string {
  const ts = texto.split(' ');
  const salida: string[] = [];
  for (let i = 0; i < ts.length; ) {
    if (!esPalabraNumero(ts[i])) { salida.push(ts[i]); i++; continue; }
    const e = entero(ts, i);
    if (!e) { salida.push(ts[i]); i++; continue; }
    let valor = String(e.valor);
    i += e.usados;
    // Decimales: "coma dos", "punto cinco"
    if ((ts[i] === 'coma' || ts[i] === 'punto') && i + 1 < ts.length) {
      const d = /^\d+$/.test(ts[i + 1]) ? { valor: Number(ts[i + 1]), usados: 1 } : entero(ts, i + 1);
      if (d) { valor = `${valor}.${d.valor}`; i += 1 + d.usados; }
    }
    salida.push(valor);
  }
  // "dos litros y medio", "cinco horas y media", "2 y medio"
  return salida.join(' ')
    .replace(/(\d+(?:\.\d+)?) (\S+ )?y (medio|media)\b/g, (_, n: string, u: string | undefined) => `${Number(n) + 0.5}${u ? ` ${u.trim()}` : ''}`)
    .replace(/\b(\d+),(\d+)\b/g, '$1.$2');
}
