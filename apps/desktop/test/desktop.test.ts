import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMainLogger, prepareLogFile } from '../src/log.js';
import { appRoute, isAppUrl, isExternalWebUrl } from '../src/navigation.js';
import { readPreferences, writePreferences } from '../src/preferences.js';
import { loadSecrets, type SystemCipher } from '../src/secrets.js';

// Cifrado de mentira: invierte los bytes para comprobar que no se guarda en claro.
const fakeCipher: SystemCipher = {
  isAvailable: () => true,
  encrypt: (plain) => Buffer.from(plain).reverse(),
  decrypt: (data) => Buffer.from(data).reverse().toString(),
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hikari-desktop-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loadSecrets', () => {
  it('genera claves válidas, las guarda cifradas y las reutiliza', () => {
    const path = join(dir, 'secrets.bin');
    const first = loadSecrets(path, fakeCipher);
    expect(first.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(Buffer.from(first.encryptionKey, 'base64')).toHaveLength(32);
    expect(readFileSync(path, 'utf8')).not.toContain(first.sessionSecret);
    expect(loadSecrets(path, fakeCipher)).toEqual(first);
  });

  it('regenera las claves si el archivo no se puede descifrar', () => {
    const path = join(dir, 'secrets.bin');
    writeFileSync(path, 'basura');
    const secrets = loadSecrets(path, fakeCipher);
    expect(Buffer.from(secrets.encryptionKey, 'base64')).toHaveLength(32);
    expect(loadSecrets(path, fakeCipher)).toEqual(secrets);
  });

  it('sin cifrado del sistema no escribe nada en disco', () => {
    const path = join(dir, 'secrets.bin');
    loadSecrets(path, { ...fakeCipher, isAvailable: () => false });
    expect(() => statSync(path)).toThrow();
  });
});

describe('log', () => {
  it('vacía el archivo cuando supera el tamaño máximo', () => {
    const path = join(dir, 'logs', 'hikari-hub.log');
    prepareLogFile(path, 10);
    const logger = createMainLogger(path);
    logger.error('fallo de prueba', new Error('detalle'));
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({
      level: 50,
      msg: 'fallo de prueba',
      err: { message: 'detalle' },
    });
    prepareLogFile(path, 10);
    expect(statSync(path).size).toBe(0);
  });
});

describe('navegación', () => {
  it('solo abre fuera enlaces http(s)', () => {
    expect(isExternalWebUrl('https://hikariro.com/?module=main')).toBe(true);
    expect(isExternalWebUrl('file:///C:/Windows/system32/calc.exe')).toBe(false);
    expect(isExternalWebUrl('javascript:alert(1)')).toBe(false);
  });

  it('reconoce las URLs de la propia app', () => {
    const origin = 'http://127.0.0.1:47231';
    expect(isAppUrl('http://127.0.0.1:47231/mvp', origin)).toBe(true);
    expect(isAppUrl('http://127.0.0.1:9999/', origin)).toBe(false);
    expect(isAppUrl('https://hikariro.com/', origin)).toBe(false);
  });

  it('las notificaciones solo abren rutas internas', () => {
    expect(appRoute('/mvp?filter=favorites')).toBe('/mvp?filter=favorites');
    expect(appRoute('//evil.test/x')).toBe('/');
    expect(appRoute('https://evil.test')).toBe('/');
  });
});

describe('preferencias', () => {
  it('usa valores por defecto y guarda los cambios', () => {
    const path = join(dir, 'preferences.json');
    expect(readPreferences(path)).toEqual({ trayHintShown: false });
    writePreferences(path, { trayHintShown: true });
    expect(readPreferences(path)).toEqual({ trayHintShown: true });
  });
});
