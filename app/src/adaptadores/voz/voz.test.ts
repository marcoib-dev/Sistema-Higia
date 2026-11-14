import { describe, expect, it } from 'vitest';
import { detectarLlamado } from './voz';

describe('palabra clave «Higia»', () => {
  it('separa el pedido del nombre', () => {
    expect(detectarLlamado('Higia, pide ayuda')).toEqual({ llamado: true, resto: 'pide ayuda' });
    expect(detectarLlamado('higía dile a Tierra que terminé')).toEqual({ llamado: true, resto: 'dile a Tierra que terminé' });
    expect(detectarLlamado('Oye Higia, ¿cómo estoy?')).toEqual({ llamado: true, resto: '¿cómo estoy?' });
  });

  it('acepta las variantes con que el reconocedor escribe el nombre', () => {
    for (const v of ['Igia', 'Hijia', 'IGIA', 'Hygeia', 'Higea']) expect(detectarLlamado(`${v} estoy bien`)).toEqual({ llamado: true, resto: 'estoy bien' });
  });

  it('solo el nombre: llamado sin pedido (se espera la frase siguiente)', () => {
    expect(detectarLlamado('Higia')).toEqual({ llamado: true, resto: '' });
  });

  it('no se activa si no la nombran al principio, ni con palabras parecidas', () => {
    expect(detectarLlamado('le dije a Higia que me ayude').llamado).toBe(false);
    expect(detectarLlamado('hija, ven aquí').llamado).toBe(false);
    expect(detectarLlamado('pide ayuda').llamado).toBe(false);
  });
});
