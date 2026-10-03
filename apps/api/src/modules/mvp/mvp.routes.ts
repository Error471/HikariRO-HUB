import { favoritesSchema } from '@hrc/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { UpstreamSession } from '../../session/upstream-session.js';
import type { UserDataStore } from '../../user/user-data-store.js';
import type { MvpService } from './mvp.service.js';

export interface MvpRoutesOptions {
  mvp: MvpService;
  upstream: UpstreamSession;
  userData: UserDataStore;
  requireSession: preHandlerAsyncHookHandler;
}

export async function mvpRoutes(app: FastifyInstance, options: MvpRoutesOptions) {
  const { mvp, upstream, userData, requireSession } = options;

  app.get('/', { preHandler: requireSession }, async (request, reply) => {
    const username = request.session?.record.username;
    if (!username) throw new AppError('UNAUTHENTICATED');
    return upstream.run(request, reply, (jar) => mvp.list(username, jar));
  });

  app.get('/favorites', { preHandler: requireSession }, async (request) => {
    const username = request.session?.record.username;
    if (!username) throw new AppError('UNAUTHENTICATED');
    return { ids: await userData.getFavorites(username) };
  });

  app.put('/favorites', { preHandler: requireSession }, async (request) => {
    const username = request.session?.record.username;
    if (!username) throw new AppError('UNAUTHENTICATED');
    const { ids } = favoritesSchema.parse(request.body);
    await userData.setFavorites(username, ids);
    return { ids };
  });
}
