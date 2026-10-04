import type { LoginRequest } from '@hikari-hub/shared';
import type { HikariAuth } from '../../hikari/hikari-auth.js';
import { AppError } from '../../lib/app-error.js';
import type { ActiveSession, SessionService } from '../../session/session-service.js';
import { throttleKey, type LoginThrottle } from './login-throttle.js';

export class AuthService {
  constructor(
    private readonly hikari: HikariAuth,
    private readonly sessions: SessionService,
    private readonly throttle: LoginThrottle,
  ) {}

  async login({ username, password, remember }: LoginRequest): Promise<ActiveSession> {
    const key = throttleKey(username);
    if (await this.throttle.isBlocked(key)) throw new AppError('RATE_LIMITED');

    try {
      const jar = await this.hikari.login(username, password);
      await this.throttle.reset(key);
      return await this.sessions.create(username, jar, remember ? password : undefined);
    } catch (error) {
      if (error instanceof AppError && error.code === 'INVALID_CREDENTIALS') {
        await this.throttle.registerFailure(key);
      }
      throw error;
    }
  }

  /** Revalida contra HikariRO como mucho cada `revalidateMs` para detectar sesiones caducadas. */
  async refresh(session: ActiveSession): Promise<ActiveSession> {
    if (!this.sessions.needsRevalidation(session)) return session;

    const jar = this.sessions.openJar(session);
    const state = await this.hikari.check(jar);
    if (state === 'authenticated') return this.sessions.touch(session, jar, true);
    // Respuesta inesperada (mantenimiento, error puntual): no se cierra la sesión por ello.
    if (state === 'unknown') return session;

    const recovered = await this.sessions.recover(session);
    if (!recovered) throw new AppError('SESSION_EXPIRED');
    return recovered;
  }

  async logout(session: ActiveSession): Promise<void> {
    try {
      await this.hikari.logout(this.sessions.openJar(session));
    } finally {
      await this.sessions.destroy(session.id);
    }
  }
}
