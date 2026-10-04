import { marketSearchQuerySchema, marketTypeSchema } from '@hikari-hub/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import type { MarketService } from './market.service.js';

export interface MarketRoutesOptions {
  markets: MarketService;
  requireSession: preHandlerAsyncHookHandler;
}

const typeParams = z.object({ type: marketTypeSchema });
const shopParams = typeParams.extend({ shopId: z.coerce.number().int().positive() });

export async function marketRoutes(app: FastifyInstance, options: MarketRoutesOptions) {
  const { markets, requireSession } = options;

  app.get('/search', { preHandler: requireSession }, async (request) => {
    const { q } = marketSearchQuerySchema.parse(request.query);
    return markets.search(q);
  });

  app.get('/:type', { preHandler: requireSession }, async (request) => {
    const { type } = typeParams.parse(request.params);
    return markets.list(type);
  });

  app.get('/:type/:shopId', { preHandler: requireSession }, async (request) => {
    const { type, shopId } = shopParams.parse(request.params);
    return markets.shop(type, shopId);
  });
}
