import { CSRF_HEADER } from '@hikari-hub/shared';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { AppError } from '../lib/app-error.js';
import { safeEqual } from '../lib/crypto.js';
import type { ActiveSession, SessionService } from '../session/session-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: ActiveSession | null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface SessionCookieOptions {
  secure: boolean;
  ttlMs: number;
}

export class SessionCookie {
  /** `__Host-` obliga al navegador a exigir Secure, path=/ y ausencia de Domain. */
  readonly name: string;

  constructor(private readonly options: SessionCookieOptions) {
    this.name = options.secure ? '__Host-hh_sid' : 'hh_sid';
  }

  set(reply: FastifyReply, sessionId: string): void {
    reply.setCookie(this.name, sessionId, {
      httpOnly: true,
      secure: this.options.secure,
      sameSite: 'strict',
      path: '/',
      signed: true,
      maxAge: Math.floor(this.options.ttlMs / 1000),
    });
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(this.name, {
      httpOnly: true,
      secure: this.options.secure,
      sameSite: 'strict',
      path: '/',
    });
  }

  read(request: FastifyRequest): string | null {
    const raw = request.cookies[this.name];
    if (!raw) return null;
    const unsigned = request.unsignCookie(raw);
    return unsigned.valid && unsigned.value ? unsigned.value : null;
  }
}

export function registerSessionGuard(app: FastifyInstance): void {
  app.decorateRequest('session', null);
}

/** preHandler para rutas privadas: exige sesión válida y token CSRF en métodos no seguros. */
export function createRequireSession(
  sessions: SessionService,
  cookie: SessionCookie,
): preHandlerAsyncHookHandler {
  return async function requireSession(request, reply) {
    const sessionId = cookie.read(request);
    if (!sessionId) {
      if (request.cookies[cookie.name]) cookie.clear(reply);
      throw new AppError('UNAUTHENTICATED');
    }

    const session = await sessions.find(sessionId);
    if (!session) {
      cookie.clear(reply);
      throw new AppError('SESSION_EXPIRED');
    }

    if (!SAFE_METHODS.has(request.method)) {
      const token = request.headers[CSRF_HEADER];
      if (typeof token !== 'string' || !safeEqual(token, session.record.csrfToken)) {
        throw new AppError('CSRF_INVALID');
      }
    }

    request.session = session;
  };
}
