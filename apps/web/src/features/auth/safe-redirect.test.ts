import { describe, expect, it } from 'vitest';
import { safeRedirect } from './LoginPage';

describe('safeRedirect', () => {
  it('permite rutas internas', () => {
    expect(safeRedirect('/mercados/vending?q=potion')).toBe('/mercados/vending?q=potion');
  });

  it.each([
    undefined,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    'javascript:alert(1)',
  ])('bloquea redirecciones externas o inválidas (%s)', (target) => {
    expect(safeRedirect(target)).toBe('/');
  });

  it('evita volver al propio login', () => {
    expect(safeRedirect('/login')).toBe('/');
  });
});
