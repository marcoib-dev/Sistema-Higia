import { describe, expect, it } from 'vitest';
import { aceptarRespuestaSinNombre, detectarLlamado, diagnosticoReconocimiento, mensajeErrorReconocimiento, partirEnOraciones, respuestaSinNombreActiva } from './voz';

describe('palabra clave «Higia»', () => {
  it('separa el pedido del nombre', () => {
    expect(detectarLlamado('Higia, pide ayuda')).toEqual({ llamado: true, resto: 'pide ayuda' });
    expect(detectarLlamado('higía dile a Tierra que terminé')).toEqual({ llamado: true, resto: 'dile a Tierra que terminé' });
    expect(detectarLlamado('Oye Higia, ¿cómo estoy?')).toEqual({ llamado: true, resto: '¿cómo estoy?' });
  });

  it('acepta las variantes con que el reconocedor escribe el nombre', () => {
    for (const v of ['Igia', 'Hijia', 'IGIA', 'Hygeia', 'Higea']) expect(detectarLlamado(`${v} estoy bien`)).toEqual({ llamado: true, resto: 'estoy bien' });
    // Vosk en español suele transcribir «Higia» como «guía», a veces con una «y» delante.
    expect(detectarLlamado('guía pide ayuda')).toEqual({ llamado: true, resto: 'pide ayuda' });
    expect(detectarLlamado('y guía pide ayuda')).toEqual({ llamado: true, resto: 'pide ayuda' });
    expect(detectarLlamado('y jia pide ayuda')).toEqual({ llamado: true, resto: 'pide ayuda' });
  });

  it('solo el nombre: llamado sin pedido (se espera la frase siguiente)', () => {
    expect(detectarLlamado('Higia')).toEqual({ llamado: true, resto: '' });
  });

  it('mantiene la escucha abierta durante unos segundos tras responder', () => {
    aceptarRespuestaSinNombre(5000);
    expect(respuestaSinNombreActiva(Date.now() + 1000)).toBe(true);
    expect(respuestaSinNombreActiva(Date.now() + 6000)).toBe(false);
  });

  it('se activa aunque no se marque la tilde al decirla (lo que escribe el reconocedor)', () => {
    for (const v of ['Hija', 'hija', 'Ija', 'Gía', 'Ilia', 'Hilia', 'Higía', 'Hixia', 'Igía']) {
      expect(detectarLlamado(`${v}, ¿cómo estoy?`), v).toEqual({ llamado: true, resto: '¿cómo estoy?' });
    }
    expect(detectarLlamado('Oye hija pide ayuda')).toEqual({ llamado: true, resto: 'pide ayuda' });
    expect(detectarLlamado('hi jia estoy bien')).toEqual({ llamado: true, resto: 'estoy bien' });
    expect(detectarLlamado('Hija')).toEqual({ llamado: true, resto: '' });
  });

  it('no se activa si no la nombran al principio, ni con palabras que solo se le parecen de lejos', () => {
    expect(detectarLlamado('le dije a Higia que me ayude').llamado).toBe(false);
    for (const f of ['día de mucho trabajo', 'tía ven', 'hijo ven aquí', 'mía', 'pide ayuda', 'iglesia', 'idea nueva', 'ya está']) {
      expect(detectarLlamado(f).llamado, f).toBe(false);
    }
  });
});

describe('diagnóstico del reconocimiento de voz', () => {
  it('avisa cuando el navegador no expone la API', () => {
    const m = diagnosticoReconocimiento({ disponible: false, seguro: true, agente: 'Mozilla/5.0 Firefox/130.0' });
    expect(m).toMatch(/no tiene reconocimiento de voz/i);
  });

  it('distingue el contexto no seguro (IP o http)', () => {
    const m = diagnosticoReconocimiento({ disponible: false, seguro: false, agente: 'Mozilla/5.0 Chrome/120' });
    expect(m).toMatch(/HTTPS o en localhost/i);
  });

  it('detecta Brave, que expone la API pero no transcribe', () => {
    const m = diagnosticoReconocimiento({ disponible: true, seguro: true, agente: 'Mozilla/5.0 Chrome/156 Safari/537.36 Brave/156' });
    expect(m).toMatch(/Brave/i);
    expect(m).toMatch(/Chrome|Edge/i);
    // Brave puede ocultar su marca en el user agent: navigator.brave lo delata.
    expect(diagnosticoReconocimiento({ disponible: true, seguro: true, agente: 'Mozilla/5.0 Chrome/156', brave: true })).toMatch(/Brave/i);
  });

  it('no inventa problemas en Chrome sobre localhost', () => {
    expect(diagnosticoReconocimiento({ disponible: true, seguro: true, agente: 'Mozilla/5.0 Chrome/156' })).toBeUndefined();
  });
});

describe('errores del reconocedor', () => {
  it('explica los más comunes', () => {
    expect(mensajeErrorReconocimiento('not-allowed')).toMatch(/permiso/i);
    expect(mensajeErrorReconocimiento('audio-capture')).toMatch(/micrófono/i);
    expect(mensajeErrorReconocimiento('network')).toMatch(/Brave|Chrome|internet/i);
    expect(mensajeErrorReconocimiento('otro')).toMatch(/falló.*otro/i);
  });
});

describe('voz neuronal: partir en oraciones', () => {
  it('separa las oraciones y pega los fragmentos muy cortos al anterior', () => {
    expect(partirEnOraciones('Varias señales leves se suman. Hoy no se recomienda salir a EVA. Sí, hoy. Prioriza el descanso.'))
      .toEqual(['Varias señales leves se suman.', 'Hoy no se recomienda salir a EVA. Sí, hoy.', 'Prioriza el descanso.']);
  });
  it('un texto sin puntuación queda entero', () => {
    expect(partirEnOraciones('Estás bien')).toEqual(['Estás bien']);
  });
});
