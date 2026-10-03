import { describe, expect, it } from 'vitest';
import { CookieJar } from '../src/lib/cookie-jar.js';
import { Sealer, safeEqual } from '../src/lib/crypto.js';

describe('Sealer', () => {
  const sealer = new Sealer(Buffer.alloc(32, 1).toString('base64'));

  it('cifra y descifra', () => {
    const sealed = sealer.seal('{"fluxSessionData":"abc"}');
    expect(sealed).not.toContain('abc');
    expect(sealer.unseal(sealed)).toBe('{"fluxSessionData":"abc"}');
  });

  it('detecta manipulación', () => {
    const sealed = sealer.seal('secreto');
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
    expect(() => sealer.unseal(tampered)).toThrow();
  });

  it('rechaza claves de longitud incorrecta', () => {
    expect(() => new Sealer(Buffer.alloc(16).toString('base64'))).toThrow();
  });

  it('compara en tiempo constante', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('CookieJar', () => {
  it('añade, rota y borra cookies', () => {
    const jar = new CookieJar();
    jar.absorb(['fluxSessionData=a=b; path=/', 'other=1']);
    expect(jar.get('fluxSessionData')).toBe('a=b');
    jar.absorb('fluxSessionData=new; path=/');
    expect(jar.toHeader()).toBe('fluxSessionData=new; other=1');
    jar.absorb('other=deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT');
    jar.absorb('fluxSessionData=x; Max-Age=0');
    expect(jar.toHeader()).toBeUndefined();
  });
});
