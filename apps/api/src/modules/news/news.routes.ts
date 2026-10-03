import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { NewsService } from './news.service.js';

export interface NewsRoutesOptions {
  news: NewsService;
  requireSession: preHandlerAsyncHookHandler;
}

export async function newsRoutes(app: FastifyInstance, options: NewsRoutesOptions) {
  const { news, requireSession } = options;
  app.get('/', { preHandler: requireSession }, () => news.list());
}
