import { AppError } from '../lib/app-error.js';
import { CookieJar, type CookieRecord } from '../lib/cookie-jar.js';
import { randomToken, type Sealer } from '../lib/crypto.js';
import type { SessionRecord, SessionStore } from './session-store.js';

export interface ActiveSession {
  id: string;
  record: SessionRecord;
}

/** Vuelve a iniciar sesión en HikariRO (lo usa "Mantener la sesión iniciada"). */
export type Relogin = (username: string, password: string) => Promise<CookieJar>;

export interface SessionServiceOptions {
  ttlMs: number;
  revalidateMs: number;
  /** Si existe, las sesiones creadas con contraseña pueden recuperarse solas. */
  relogin?: Relogin;
}

export class SessionService {
  // Evita dos logins a la vez para la misma sesión (vigilante + petición del usuario).
  private readonly recovering = new Map<string, Promise<ActiveSession | null>>();

  constructor(
    private readonly store: SessionStore,
    private readonly sealer: Sealer,
    private readonly options: SessionServiceOptions,
  ) {}

  get canRemember(): boolean {
    return this.options.relogin !== undefined;
  }

  /** `password` solo se guarda (cifrada) si el usuario pidió mantener la sesión iniciada. */
  async create(username: string, jar: CookieJar, password?: string): Promise<ActiveSession> {
    const now = Date.now();
    const id = randomToken();
    const record: SessionRecord = {
      username,
      upstream: this.sealJar(jar),
      csrfToken: randomToken(),
      createdAt: now,
      expiresAt: now + this.options.ttlMs,
      validatedAt: now,
      ...(password && this.canRemember && { credentials: this.sealer.seal(password) }),
    };
    await this.store.set(id, record);
    return { id, record };
  }

  async find(id: string): Promise<ActiveSession | null> {
    const record = await this.store.get(id);
    if (!record || record.expiresAt <= Date.now()) return null;
    return { id, record };
  }

  list(): Promise<string[]> {
    return this.store.list();
  }

  destroy(id: string): Promise<void> {
    return this.store.delete(id);
  }

  needsRevalidation(session: ActiveSession): boolean {
    return Date.now() - session.record.validatedAt >= this.options.revalidateMs;
  }

  openJar(session: ActiveSession): CookieJar {
    try {
      return new CookieJar(JSON.parse(this.sealer.unseal(session.record.upstream)) as CookieRecord);
    } catch (error) {
      throw new AppError('SESSION_EXPIRED', { cause: error });
    }
  }

  /** Guarda las cookies (FluxCP puede rotarlas) y extiende la caducidad deslizante. */
  async touch(session: ActiveSession, jar: CookieJar, validated: boolean): Promise<ActiveSession> {
    const now = Date.now();
    const record: SessionRecord = {
      ...session.record,
      upstream: this.sealJar(jar),
      expiresAt: now + this.options.ttlMs,
      validatedAt: validated ? now : session.record.validatedAt,
    };
    await this.store.set(session.id, record);
    return { id: session.id, record };
  }

  /**
   * HikariRO cerró su sesión: si el usuario pidió mantenerla, vuelve a entrar con la
   * contraseña guardada. Devuelve `null` (y destruye la sesión) si no es posible.
   * Si HikariRO no responde, el error se propaga y la sesión se conserva.
   */
  recover(session: ActiveSession): Promise<ActiveSession | null> {
    const pending = this.recovering.get(session.id);
    if (pending) return pending;
    const attempt = this.relogin(session).finally(() => this.recovering.delete(session.id));
    this.recovering.set(session.id, attempt);
    return attempt;
  }

  /**
   * Usa la sesión sin una petición del usuario (avisos y mantenimiento en segundo plano).
   * Guarda las cookies rotadas pero no extiende la caducidad de la sesión de Hikari Hub.
   */
  async runDetached<T>(
    sessionId: string,
    task: (jar: CookieJar, session: ActiveSession) => Promise<T>,
  ): Promise<{ status: 'ok'; value: T } | { status: 'gone' }> {
    const found = await this.find(sessionId);
    if (!found) return { status: 'gone' };
    let session: ActiveSession = found;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const jar = this.openJar(session);
        const value = await task(jar, session);
        await this.store.set(sessionId, { ...session.record, upstream: this.sealJar(jar) });
        return { status: 'ok', value };
      } catch (error) {
        if (!(error instanceof AppError && error.code === 'SESSION_EXPIRED')) throw error;
        const recovered: ActiveSession | null = attempt === 0 ? await this.recover(session) : null;
        if (!recovered) {
          await this.destroy(sessionId);
          return { status: 'gone' };
        }
        session = recovered;
      }
    }
    return { status: 'gone' };
  }

  private async relogin(session: ActiveSession): Promise<ActiveSession | null> {
    const { credentials, username } = session.record;
    if (!credentials || !this.options.relogin) {
      await this.destroy(session.id);
      return null;
    }
    try {
      const jar = await this.options.relogin(username, this.sealer.unseal(credentials));
      const current = (await this.find(session.id)) ?? session;
      return await this.touch(current, jar, true);
    } catch (error) {
      // Contraseña cambiada o datos dañados: hay que volver a entrar a mano.
      if (error instanceof AppError && error.code !== 'INVALID_CREDENTIALS') throw error;
      await this.destroy(session.id);
      return null;
    }
  }

  private sealJar(jar: CookieJar): string {
    return this.sealer.seal(JSON.stringify(jar.toJSON()));
  }
}
