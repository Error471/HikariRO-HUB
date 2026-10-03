import { describe, expect, it } from 'vitest';
import { wikiCategoryPath, wikiPath, wikiTitleSchema } from './wiki.js';

describe('wiki', () => {
  it('normaliza títulos de MediaWiki', () => {
    expect(wikiTitleSchema.parse('Sistema_de_pesca')).toBe('Sistema de pesca');
    expect(wikiTitleSchema.safeParse('<script>').success).toBe(false);
    expect(wikiTitleSchema.safeParse('').success).toBe(false);
  });

  it('genera rutas de la app legibles', () => {
    expect(wikiPath('Clock Tower: Unknown Basement')).toBe('/wiki/Clock_Tower%3A_Unknown_Basement');
    expect(wikiPath('Página principal')).toBe('/wiki/P%C3%A1gina_principal');
    expect(wikiCategoryPath('Guías')).toBe('/wiki/categoria/Gu%C3%ADas');
  });
});
