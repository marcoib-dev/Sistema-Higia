import { describe, expect, it } from 'vitest';
import { elegirVoz, esNatural, puntuarVoz, type VozInfo } from './vocesNavegador';

const v = (name: string, lang: string, localService = true): VozInfo => ({ name, lang, localService });

const WINDOWS_EDGE = [
  v('Microsoft Helena - Spanish (Spain)', 'es-ES'),
  v('Microsoft Sabina - Spanish (Mexico)', 'es-MX'),
  v('Microsoft Elvira Online (Natural) - Spanish (Spain)', 'es-ES', false),
  v('Microsoft Elena Online (Natural) - Spanish (Argentina)', 'es-AR', false),
  v('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false),
  v('Microsoft Zira - English (United States)', 'en-US'),
];
const CHROME = [v('Microsoft Helena - Spanish (Spain)', 'es-ES'), v('Google español', 'es-ES', false), v('Google español de Estados Unidos', 'es-US', false), v('Google US English', 'en-US', false)];

describe('elección de voz del navegador', () => {
  it('en Edge prefiere la voz natural argentina', () => {
    expect(elegirVoz(WINDOWS_EDGE, 'es')?.name).toContain('Elena');
  });
  it('sin internet descarta las voces en línea y usa una local', () => {
    expect(elegirVoz(WINDOWS_EDGE, 'es', false)?.name).toContain('Sabina');
  });
  it('en Chrome prefiere las de Google, con acento latino si lo hay', () => {
    expect(elegirVoz(CHROME, 'es')?.name).toBe('Google español de Estados Unidos');
  });
  it('respeta el idioma de la página', () => {
    expect(elegirVoz(WINDOWS_EDGE, 'en')?.name).toContain('Aria');
    expect(puntuarVoz(v('Google US English', 'en-US'), 'es')).toBe(-1);
  });
  it('sin voces del idioma devuelve null', () => {
    expect(elegirVoz([v('Google US English', 'en-US')], 'es')).toBeNull();
  });
  it('reconoce las voces neuronales', () => {
    expect(esNatural(WINDOWS_EDGE[3])).toBe(true);
    expect(esNatural(CHROME[1])).toBe(false);
  });
});
