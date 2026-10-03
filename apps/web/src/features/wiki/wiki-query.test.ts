import { wikiPath } from '@hrc/shared';
import { describe, expect, it } from 'vitest';
import { titleFromPath } from './wiki-query';

describe('titleFromPath', () => {
  it('recupera el título desde la ruta', () => {
    for (const title of ['Página principal', 'Clock Tower: Unknown Basement', 'VIP System']) {
      expect(titleFromPath(wikiPath(title).replace('/wiki/', ''))).toBe(title);
    }
  });

  it('tolera segmentos mal codificados', () => {
    expect(titleFromPath('100%_real')).toBe('100% real');
  });
});
