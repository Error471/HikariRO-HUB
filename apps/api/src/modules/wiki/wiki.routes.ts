import { wikiSearchQuerySchema, wikiTitleSchema } from '@hikari-hub/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createReadStream } from 'node:fs';
import { AppError } from '../../lib/app-error.js';
import { wikiImageType, type WikiStore } from './wiki-store.js';
import type { WikiService } from './wiki.service.js';

export interface WikiRoutesOptions {
  wiki: WikiService;
  store: WikiStore;
}

const pageQuery = z.object({ title: wikiTitleSchema });
const categoryParams = z.object({ name: wikiTitleSchema });

export async function wikiRoutes(app: FastifyInstance, options: WikiRoutesOptions) {
  const { wiki, store } = options;

  // La wiki es una copia local sin datos de usuario: se puede leer sin iniciar sesión.
  // Estado de la descarga de la copia local; con `POST /download` se reintenta tras un fallo.
  app.get('/status', async () => store.status());
  app.post('/download', async () => {
    void store.sync();
    return store.status();
  });

  // El título va en la query (?title=) porque puede contener "/" y ":".
  app.get('/page', async (request) => wiki.page(pageQuery.parse(request.query).title));

  app.get('/search', async (request) => wiki.search(wikiSearchQuerySchema.parse(request.query).q));

  app.get('/categories', async () => wiki.allCategories());

  app.get('/categories/:name', async (request) =>
    wiki.category(categoryParams.parse(request.params).name),
  );

  app.get('/index', async () => wiki.index());
}

/** Imágenes de la wiki descargadas (`/wiki-img/<archivo>`), fuera de /api porque las usan las propias páginas. */
export async function wikiImageRoutes(app: FastifyInstance, options: { store: WikiStore }) {
  app.get<{ Params: { name: string } }>('/wiki-img/:name', async (request, reply) => {
    const file = options.store.imagePath(request.params.name);
    const type = wikiImageType(request.params.name);
    if (!file || !type) throw new AppError('NOT_FOUND');
    return reply
      .header('cache-control', 'public, max-age=86400')
      .type(type)
      .send(createReadStream(file));
  });
}
