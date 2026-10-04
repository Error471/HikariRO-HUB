import { wikiSearchQuerySchema, wikiTitleSchema } from '@hikari-hub/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import type { WikiService } from './wiki.service.js';

export interface WikiRoutesOptions {
  wiki: WikiService;
  requireSession: preHandlerAsyncHookHandler;
}

const pageQuery = z.object({ title: wikiTitleSchema });
const categoryParams = z.object({ name: wikiTitleSchema });

export async function wikiRoutes(app: FastifyInstance, options: WikiRoutesOptions) {
  const { wiki, requireSession } = options;
  const opts = { preHandler: requireSession };

  // El título va en la query (?title=) porque puede contener "/" y ":".
  app.get('/page', opts, async (request) => wiki.page(pageQuery.parse(request.query).title));

  app.get('/search', opts, async (request) =>
    wiki.search(wikiSearchQuerySchema.parse(request.query).q),
  );

  app.get('/categories', opts, async () => wiki.allCategories());

  app.get('/categories/:name', opts, async (request) =>
    wiki.category(categoryParams.parse(request.params).name),
  );

  app.get('/index', opts, async () => wiki.index());
}
