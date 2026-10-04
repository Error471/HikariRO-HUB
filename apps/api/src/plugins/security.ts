import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/app-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface SecurityOptions {
  appOrigin: string;
  /** Límite global de peticiones a /api por minuto; 0 = solo las rutas sensibles (login…). */
  rateLimitPerMinute: number;
}

export async function registerSecurity(app: FastifyInstance, options: SecurityOptions) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  await app.register(rateLimit, {
    global: options.rateLimitPerMinute > 0,
    max: options.rateLimitPerMinute || 300,
    timeWindow: '1 minute',
    // Los archivos de la web (app de escritorio) no cuentan: una sola carga pide decenas.
    allowList: (request) => !request.url.startsWith('/api/'),
    errorResponseBuilder: () => new AppError('RATE_LIMITED'),
  });

  const allowedOrigin = new URL(options.appOrigin).origin;
  app.addHook('onRequest', async (request) => {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin ?? originOf(request.headers.referer);
    if (origin !== allowedOrigin) throw new AppError('CSRF_INVALID');
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
    return payload;
  });
}

function originOf(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
