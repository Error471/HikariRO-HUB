import { wikiSearchQuerySchema, wikiTitleSchema } from '@hikari-hub/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WikiService } from './wiki.service.js';

export interface WikiRoutesOptions {
  wiki: WikiService;
}

const pageQuery = z.object({ title: wikiTitleSchema });
const categoryParams = z.object({ name: wikiTitleSchema });

export async function wikiRoutes(app: FastifyInstance, options: WikiRoutesOptions) {
  const { wiki } = options;

  // La wiki es una copia local sin datos de usuario: se puede leer sin iniciar sesión.
  // El título va en la query (?title=) porque puede contener "/" y ":".
  app.get('/page', async (request) => wiki.page(pageQuery.parse(request.query).title));

  app.get('/search', async (request) =>
    wiki.search(wikiSearchQuerySchema.parse(request.query).q),
  );

  app.get('/categories', async () => wiki.allCategories());

  app.get('/categories/:name', async (request) =>
    wiki.category(categoryParams.parse(request.params).name),
  );

  app.get('/index', async () => wiki.index());
}
