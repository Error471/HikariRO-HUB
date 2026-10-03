export type CookieRecord = Record<string, string>;

/** Jar mínimo para las cookies de HikariRO (un único host, sin dominios ni paths). */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  constructor(initial: CookieRecord = {}) {
    for (const [name, value] of Object.entries(initial)) this.cookies.set(name, value);
  }

  /** Aplica cabeceras Set-Cookie: altas, modificaciones y borrados. */
  absorb(setCookie: string | string[] | undefined): void {
    if (!setCookie) return;
    const headers = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const header of headers) this.absorbOne(header);
  }

  toHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  toJSON(): CookieRecord {
    return Object.fromEntries(this.cookies);
  }

  private absorbOne(header: string): void {
    const [pair = '', ...attributes] = header.split(';');
    const separator = pair.indexOf('=');
    if (separator <= 0) return;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (isDeletion(value, attributes)) {
      this.cookies.delete(name);
      return;
    }
    this.cookies.set(name, value);
  }
}

function isDeletion(value: string, attributes: string[]): boolean {
  if (value === '' || value === 'deleted') return true;
  for (const attribute of attributes) {
    const [rawKey = '', rawValue = ''] = attribute.split('=');
    const key = rawKey.trim().toLowerCase();
    if (key === 'max-age' && Number(rawValue.trim()) <= 0) return true;
    if (key === 'expires') {
      const expires = Date.parse(rawValue.trim());
      if (!Number.isNaN(expires) && expires < Date.now()) return true;
    }
  }
  return false;
}
