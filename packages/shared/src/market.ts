import { z } from 'zod';

export const marketTypeSchema = z.enum(['vending', 'buying']);
export type MarketType = z.infer<typeof marketTypeSchema>;

export const marketItemExtraSchema = z.object({
  /** Etiqueta de HikariRO, p. ej. "Cartas". */
  label: z.string(),
  entries: z.array(z.object({ itemId: z.number().nullable(), name: z.string() })),
});

export const marketItemSchema = z.object({
  itemId: z.number(),
  name: z.string(),
  iconUrl: z.string(),
  detailUrl: z.string(),
  refine: z.number().nullable(),
  slots: z.number().nullable(),
  /** Unidades en venta (vending) o solicitadas (buying store). */
  amount: z.number(),
  /** Precio por unidad en zeny. */
  unitPrice: z.number(),
  extras: z.array(marketItemExtraSchema),
});
export type MarketItem = z.infer<typeof marketItemSchema>;

export const marketShopSchema = z.object({
  id: z.number(),
  type: marketTypeSchema,
  title: z.string(),
  owner: z.string(),
  map: z.string(),
  x: z.number().nullable(),
  y: z.number().nullable(),
  sourceUrl: z.string(),
  items: z.array(marketItemSchema),
});
export type MarketShop = z.infer<typeof marketShopSchema>;

export const marketShopsResponseSchema = z.object({
  type: marketTypeSchema,
  updatedAt: z.string(),
  shops: z.array(marketShopSchema),
});
export type MarketShopsResponse = z.infer<typeof marketShopsResponseSchema>;

export const marketShopResponseSchema = z.object({
  updatedAt: z.string(),
  shop: marketShopSchema,
});
export type MarketShopResponse = z.infer<typeof marketShopResponseSchema>;

export const marketOfferSchema = z.object({
  item: marketItemSchema,
  shop: marketShopSchema.omit({ items: true }),
});
export type MarketOffer = z.infer<typeof marketOfferSchema>;

export const marketSearchResponseSchema = z.object({
  query: z.string(),
  updatedAt: z.string(),
  /** Ofertas de venta, de más barata a más cara. */
  vending: z.array(marketOfferSchema),
  /** Ofertas de compra, de mejor a peor precio. */
  buying: z.array(marketOfferSchema),
});
export type MarketSearchResponse = z.infer<typeof marketSearchResponseSchema>;

export const marketSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(64),
});
