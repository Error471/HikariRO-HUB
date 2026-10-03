import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { SessionCookie } from '../../plugins/session-guard.js';
import type { UserDataStore } from '../../user/user-data-store.js';
import type { AuthService } from '../auth/auth.service.js';

export interface AccountRoutesOptions {
  auth: AuthService;
  userData: UserDataStore;
  cookie: SessionCookie;
  requireSession: preHandlerAsyncHookHandler;
}

export async function accountRoutes(app: FastifyInstance, options: AccountRoutesOptions) {
  const { auth, userData, cookie, requireSession } = options;

  // Borra todo lo que el Companion guarda de la cuenta y cierra la sesión actual.
  app.delete(
    '/data',
    { preHandler: requireSession, config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (request, reply) => {
      const session = request.session;
      if (!session) throw new AppError('UNAUTHENTICATED');

      await userData.deleteUser(session.record.username);
      await auth.logout(session).catch((error: unknown) => {
        // La sesión del Companion ya está destruida; si HikariRO no responde, caducará sola.
        request.log.warn({ err: error }, 'no se pudo cerrar la sesión en HikariRO');
      });
      cookie.clear(reply);
      request.log.info({ event: 'account-data-deleted' }, 'datos de la cuenta borrados');
      return reply.status(204).send();
    },
  );
}
