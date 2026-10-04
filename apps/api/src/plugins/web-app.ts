import fastifyStatic from '@fastify/static';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** La API ya pone `default-src 'none'`; la web necesita cargar sus propios recursos. */
const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

function setWebHeaders(reply: FastifyReply, url: string) {
  reply.header('content-security-policy', WEB_CSP);
  reply.header(
    'cache-control',
    url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
}

/** Sirve el build de la web desde la API (app de escritorio: un solo proceso, un solo origen). */
export async function registerWebApp(app: FastifyInstance, root: string) {
  await app.register(async (scope) => {
    // wildcard: false crea una ruta por archivo; lo demás cae en el fallback de la SPA.
    await scope.register(fastifyStatic, {
      root,
      index: false,
      wildcard: false,
      cacheControl: false,
    });
    const fallback = createSpaFallback(root);
    scope.get('/', (_request, reply) => fallback.send(reply));
    scope.addHook('onSend', async (request, reply, payload) => {
      setWebHeaders(reply, request.url);
      return payload;
    });
  });
}

/**
 * Rutas de la SPA (p. ej. /mvp): cualquier GET que no sea de la API devuelve index.html.
 * El HTML se lee una vez: el build de la web no cambia mientras la app está abierta.
 */
export function createSpaFallback(root: string) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  return {
    matches(request: FastifyRequest): boolean {
      return (
        (request.method === 'GET' || request.method === 'HEAD') &&
        request.url !== '/api' &&
        !request.url.startsWith('/api/')
      );
    },
    send(reply: FastifyReply) {
      setWebHeaders(reply, '/index.html');
      return reply.type('text/html; charset=utf-8').send(html);
    },
  };
}
