import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../lib/app-error.js';
import type { CookieJar } from '../lib/cookie-jar.js';
import type { SessionCookie } from '../plugins/session-guard.js';
import type { ActiveSession, SessionService } from './session-service.js';

/**
 * Ejecuta peticiones a HikariRO con las cookies del usuario: guarda las cookies
 * rotadas y, si HikariRO invalida la sesión y no se puede recuperar, la destruye también
 * en Hikari Hub.
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
    if (!request.session) throw new AppError('UNAUTHENTICATED');
    let session: ActiveSession = request.session;

    for (let attempt = 0; ; attempt += 1) {
      const jar = this.sessions.openJar(session);
      try {
        const result = await task(jar);
        request.session = await this.sessions.touch(session, jar, true);
        return result;
      } catch (error) {
        if (!(error instanceof AppError && error.code === 'SESSION_EXPIRED')) throw error;
        // Con "Mantener la sesión iniciada" se vuelve a entrar y se repite una vez.
        const recovered: ActiveSession | null =
          attempt === 0 ? await this.sessions.recover(session) : null;
        if (!recovered) {
          await this.sessions.destroy(session.id);
          this.cookie.clear(reply);
          throw error;
        }
        session = recovered;
      }
    }
  }
}
