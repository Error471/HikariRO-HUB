import { describe, expect, it } from 'vitest';
import { visiblePages } from './Pagination';

describe('visiblePages', () => {
  it('muestra la primera, la última y las vecinas', () => {
    expect(visiblePages(10, 74)).toEqual([1, 'gap', 9, 10, 11, 'gap', 74]);
    expect(visiblePages(1, 3)).toEqual([1, 2, 3]);
    expect(visiblePages(2, 4)).toEqual([1, 2, 3, 4]);
  });
});
