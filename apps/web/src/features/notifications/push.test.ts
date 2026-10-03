import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, detectPushSupport } from './push';

describe('base64UrlToBytes', () => {
  it('decodifica base64url sin relleno', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe('detectPushSupport', () => {
  const base = {
    hasServiceWorker: true,
    hasPushManager: true,
    isAppleMobile: false,
    isStandalone: false,
  };

  it('detecta navegadores compatibles', () => {
    expect(detectPushSupport(base)).toBe('supported');
  });

  it('pide instalar la app en iPhone fuera de la pantalla de inicio', () => {
    expect(detectPushSupport({ ...base, hasPushManager: false, isAppleMobile: true })).toBe(
      'needs-install',
    );
  });

  it('marca como no compatible el resto', () => {
    expect(detectPushSupport({ ...base, hasPushManager: false })).toBe('unsupported');
  });
});
