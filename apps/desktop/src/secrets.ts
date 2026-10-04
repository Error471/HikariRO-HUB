import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export interface Secrets {
  sessionSecret: string;
  encryptionKey: string;
}

/** Cifrado del sistema (en Windows, DPAPI a través de `safeStorage` de Electron). */
export interface SystemCipher {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

const generate = (): Secrets => ({
  sessionSecret: randomBytes(48).toString('base64url'),
  encryptionKey: randomBytes(32).toString('base64'),
});

function isValid(value: unknown): value is Secrets {
  if (typeof value !== 'object' || value === null) return false;
  const { sessionSecret, encryptionKey } = value as Partial<Secrets>;
  return (
    typeof sessionSecret === 'string' &&
    sessionSecret.length >= 32 &&
    typeof encryptionKey === 'string' &&
    Buffer.from(encryptionKey, 'base64').length === 32
  );
}

/**
 * Claves propias de esta instalación, guardadas cifradas por Windows.
 * Si no se pueden leer (primer arranque, perfil copiado de otro PC) se generan nuevas:
 * las sesiones guardadas dejan de valer y basta con volver a iniciar sesión.
 */
export function loadSecrets(path: string, cipher: SystemCipher): Secrets {
  if (!cipher.isAvailable()) return generate();
  try {
    const stored: unknown = JSON.parse(cipher.decrypt(readFileSync(path)));
    if (isValid(stored)) return stored;
  } catch {
    // Archivo inexistente o ilegible: se regenera.
  }
  const secrets = generate();
  writeFileSync(path, cipher.encrypt(JSON.stringify(secrets)), { mode: 0o600 });
  return secrets;
}
