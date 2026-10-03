import { loginRequestSchema, type SessionResponse } from '@hrc/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { SessionCookie } from '../../plugins/session-guard.js';
import type { ActiveSession } from '../../session/session-service.js';
import type { AuthService } from './auth.service.js';

/** Avisos de inicio y fin de sesión (p. ej. para que los avisos push usen la sesión nueva). */
export interface SessionEvents {
  sessionStarted(username: string, sessionId: string): Promise<void>;
  sessionEnded(username: string, sessionId: string): Promise<void>;
}

export interface AuthRoutesOptions {
  auth: AuthService;
  sessionEvents: SessionEvents;
  cookie: SessionCookie;
  requireSession: preHandlerAsyncHookHandler;
  loginRateLimit: { max: number; timeWindowMs: number };
}

function toResponse({ record }: ActiveSession): SessionResponse {
  return {
    user: { username: record.username },
    csrfToken: record.csrfToken,
    expiresAt: new Date(record.expiresAt).toISOString(),
  };
}

function currentSession(session: ActiveSession | null): ActiveSession {
  if (!session) throw new AppError('UNAUTHENTICATED');
  return session;
}

export async function authRoutes(app: FastifyInstance, options: AuthRoutesOptions) {
  const { auth, cookie, requireSession, loginRateLimit, sessionEvents } = options;

  app.post(
    '/login',
    {
      config: {
        rateLimit: { max: loginRateLimit.max, timeWindow: loginRateLimit.timeWindowMs },
      },
    },
    async (request, reply) => {
      const credentials = loginRequestSchema.parse(request.body);
      const session = await auth.login(credentials);
      cookie.set(reply, session.id);
      await sessionEvents
        .sessionStarted(session.record.username, session.id)
        .catch((error: unknown) =>
          request.log.warn({ err: error }, 'no se pudo actualizar avisos'),
        );
      request.log.info({ event: 'login' }, 'login correcto');
      return toResponse(session);
    },
  );

  app.get('/me', { preHandler: requireSession }, async (request, reply) => {
    try {
      const session = await auth.refresh(currentSession(request.session));
      return toResponse(session);
    } catch (error) {
      if (error instanceof AppError && error.code === 'SESSION_EXPIRED') cookie.clear(reply);
      throw error;
    }
  });

  app.post('/logout', { preHandler: requireSession }, async (request, reply) => {
    const session = currentSession(request.session);
    await sessionEvents
      .sessionEnded(session.record.username, session.id)
      .catch((error: unknown) => request.log.warn({ err: error }, 'no se pudo actualizar avisos'));
    await auth.logout(session);
    cookie.clear(reply);
    return reply.status(204).send();
  });
}
