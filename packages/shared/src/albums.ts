import { z } from 'zod';

export const cardStatusSchema = z.enum(['all', 'found', 'missing']);
export type CardStatus = z.infer<typeof cardStatusSchema>;

export const cardSortSchema = z.enum(['id', 'name']);
export type CardSort = z.infer<typeof cardSortSchema>;

export const cardAlbumQuerySchema = z.object({
  status: cardStatusSchema.default('all'),
  sort: cardSortSchema.default('id'),
  q: z.string().trim().max(50).default(''),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
export type CardAlbumQuery = z.infer<typeof cardAlbumQuerySchema>;

export const albumProgressSchema = z.object({
  obtained: z.number(),
  total: z.number(),
});
export type AlbumProgress = z.infer<typeof albumProgressSchema>;

export const albumCardSchema = z.object({
  id: z.number(),
  name: z.string(),
  imageUrl: z.string(),
  iconUrl: z.string(),
  detailUrl: z.string(),
  obtained: z.boolean(),
});
export type AlbumCard = z.infer<typeof albumCardSchema>;

export const cardAlbumResponseSchema = z.object({
  /** Progreso global de la cuenta (independiente de filtros). */
  progress: albumProgressSchema,
  /** Resultados que cumplen el filtro actual. */
  results: z.number(),
  page: z.number(),
  pages: z.number(),
  pageSize: z.number(),
  cards: z.array(albumCardSchema),
});
export type CardAlbumResponse = z.infer<typeof cardAlbumResponseSchema>;

export const fishSchema = z.discriminatedUnion('discovered', [
  z.object({
    discovered: z.literal(true),
    itemId: z.number().nullable(),
    name: z.string(),
    imageUrl: z.string(),
    iconUrl: z.string().nullable(),
    /** Calidad máxima conseguida (0-5 estrellas). */
    stars: z.number(),
    sizeCm: z.number().nullable(),
    weightKg: z.number().nullable(),
    catches: z.number().nullable(),
    /** Mapa del ejemplar más grande; `null` si HikariRO lo muestra como "Unknown". */
    bestMap: z.string().nullable(),
  }),
  z.object({
    discovered: z.literal(false),
    imageUrl: z.string(),
  }),
]);
export type Fish = z.infer<typeof fishSchema>;

export const fishingAlbumResponseSchema = z.object({
  progress: albumProgressSchema,
  fish: z.array(fishSchema),
});
export type FishingAlbumResponse = z.infer<typeof fishingAlbumResponseSchema>;
