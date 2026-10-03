import { AppError } from '../lib/app-error.js';
import { CookieJar, type CookieRecord } from '../lib/cookie-jar.js';
import { randomToken, type Sealer } from '../lib/crypto.js';
import type { SessionRecord, SessionStore } from './session-store.js';

export interface ActiveSession {
  id: string;
  record: SessionRecord;
}

export interface SessionServiceOptions {
  ttlMs: number;
  revalidateMs: number;
}

export class SessionService {
  constructor(
    private readonly store: SessionStore,
    private readonly sealer: Sealer,
    private readonly options: SessionServiceOptions,
  ) {}

  async create(username: string, jar: CookieJar): Promise<ActiveSession> {
    const now = Date.now();
    const id = randomToken();
    const record: SessionRecord = {
      username,
      upstream: this.sealJar(jar),
      csrfToken: randomToken(),
      createdAt: now,
      expiresAt: now + this.options.ttlMs,
      validatedAt: now,
    };
    await this.store.set(id, record);
    return { id, record };
  }

  async find(id: string): Promise<ActiveSession | null> {
    const record = await this.store.get(id);
    if (!record || record.expiresAt <= Date.now()) return null;
    return { id, record };
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
   * Usa la sesión sin una petición del usuario (avisos en segundo plano). Guarda las
   * cookies rotadas pero no extiende la caducidad: la sesión caduca igual que si no se usara.
   */
  async runDetached<T>(
    sessionId: string,
    task: (jar: CookieJar, session: ActiveSession) => Promise<T>,
  ): Promise<{ status: 'ok'; value: T } | { status: 'gone' }> {
    const session = await this.find(sessionId);
    if (!session) return { status: 'gone' };
    try {
      const jar = this.openJar(session);
      const value = await task(jar, session);
      await this.store.set(sessionId, { ...session.record, upstream: this.sealJar(jar) });
      return { status: 'ok', value };
    } catch (error) {
      if (error instanceof AppError && error.code === 'SESSION_EXPIRED') {
        await this.destroy(sessionId);
        return { status: 'gone' };
      }
      throw error;
    }
  }

  private sealJar(jar: CookieJar): string {
    return this.sealer.seal(JSON.stringify(jar.toJSON()));
  }
}
