import { cardAlbumQuerySchema } from '@hikari-hub/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { UpstreamSession } from '../../session/upstream-session.js';
import type { AlbumService } from './album.service.js';

export interface AlbumRoutesOptions {
  albums: AlbumService;
  upstream: UpstreamSession;
  requireSession: preHandlerAsyncHookHandler;
}

export async function albumRoutes(app: FastifyInstance, options: AlbumRoutesOptions) {
  const { albums, upstream, requireSession } = options;

  app.get('/cards', { preHandler: requireSession }, async (request, reply) => {
    const username = request.session?.record.username;
    if (!username) throw new AppError('UNAUTHENTICATED');
    const query = cardAlbumQuerySchema.parse(request.query);
    return upstream.run(request, reply, (jar) => albums.cardPage(username, query, jar));
  });

  app.get('/fishing', { preHandler: requireSession }, async (request, reply) => {
    const username = request.session?.record.username;
    if (!username) throw new AppError('UNAUTHENTICATED');
    return upstream.run(request, reply, (jar) => albums.fishingAlbum(username, jar));
  });
}
