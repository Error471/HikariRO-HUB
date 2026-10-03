import { z } from 'zod';

export const newsSections = ['noticias', 'eventos', 'changelog'] as const;
export const newsSectionSchema = z.enum([...newsSections, 'otros']);
export type NewsSection = z.infer<typeof newsSectionSchema>;

export const newsPostSchema = z.object({
  id: z.string(),
  section: newsSectionSchema,
  author: z.string(),
  /** Primera línea del post sin formato (Discord no tiene campo título). */
  title: z.string(),
  summary: z.string(),
  /** Markdown de Discord original; se renderiza en cliente sin HTML. */
  content: z.string(),
  /** `content` sin la línea usada como título. */
  body: z.string(),
  publishedAt: z.string(),
  imageUrl: z.string().nullable(),
  sourceUrl: z.string().nullable(),
});
export type NewsPost = z.infer<typeof newsPostSchema>;

export const newsListResponseSchema = z.object({
  updatedAt: z.string().nullable(),
  posts: z.array(newsPostSchema),
});
export type NewsListResponse = z.infer<typeof newsListResponseSchema>;
