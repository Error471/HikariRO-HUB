import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../lib/app-error.js';
import type { CookieJar } from '../lib/cookie-jar.js';
import type { SessionCookie } from '../plugins/session-guard.js';
import type { SessionService } from './session-service.js';

/**
 * Ejecuta peticiones a HikariRO con las cookies del usuario: guarda las cookies
 * rotadas y, si HikariRO invalida la sesión, la destruye también en el Companion.
 */
export class UpstreamSession {
  constructor(
    private readonly sessions: SessionService,
    private readonly cookie: SessionCookie,
  ) {}

  async run<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    task: (jar: CookieJar) => Promise<T>,
  ): Promise<T> {
    const session = request.session;
    if (!session) throw new AppError('UNAUTHENTICATED');
    const jar = this.sessions.openJar(session);

    try {
      const result = await task(jar);
      request.session = await this.sessions.touch(session, jar, true);
      return result;
    } catch (error) {
      if (error instanceof AppError && error.code === 'SESSION_EXPIRED') {
        await this.sessions.destroy(session.id);
        this.cookie.clear(reply);
      }
      throw error;
    }
  }
}
