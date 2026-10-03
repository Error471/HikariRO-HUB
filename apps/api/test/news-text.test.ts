import { describe, expect, it } from 'vitest';
import {
  bodyWithoutTitle,
  discordToPlainText,
  extractTitleAndSummary,
} from '../src/modules/news/news-text.js';

describe('discordToPlainText', () => {
  it('quita menciones, emojis personalizados y formato', () => {
    expect(discordToPlainText('@everyone **Hola** <@123> <:poring:999> __mundo__ ~~x~~')).toBe(
      ' Hola   mundo x',
    );
  });

  it('convierte enlaces con texto y cabeceras', () => {
    expect(discordToPlainText('# Título\n[web](https://hikariro.com)')).toBe('Título\nweb');
  });
});

describe('extractTitleAndSummary', () => {
  it('usa la primera línea con texto como título', () => {
    const result = extractTitleAndSummary('@everyone \n📱 **¡Nuevo!**\n\nTexto del post.', 'A');
    expect(result).toEqual({ title: '📱 ¡Nuevo!', summary: 'Texto del post.' });
  });

  it('no inventa un título cuando no hay texto', () => {
    expect(extractTitleAndSummary('', 'Staff')).toEqual({
      title: 'Publicación de Staff',
      summary: '',
    });
  });

  it('recorta resúmenes largos por palabra', () => {
    const { summary } = extractTitleAndSummary(`T\n${'palabra '.repeat(80)}`, 'A');
    expect(summary.length).toBeLessThanOrEqual(221);
    expect(summary.endsWith('…')).toBe(true);
  });
});

describe('bodyWithoutTitle', () => {
  it('quita las menciones iniciales y la línea del título', () => {
    expect(bodyWithoutTitle('@everyone \n# **Título**\n\nCuerpo\n- punto')).toBe('Cuerpo\n- punto');
  });

  it('devuelve vacío si no hay texto', () => {
    expect(bodyWithoutTitle('@everyone')).toBe('');
  });
});
