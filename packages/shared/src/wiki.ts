import { z } from 'zod';

export const WIKI_MAIN_PAGE = 'Página principal';

/** Título de página MediaWiki: sin caracteres prohibidos por MediaWiki. */
export const wikiTitleSchema = z
  .string()
  .transform((value) => value.replace(/_/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(255)
      .regex(/^[^#<>[\]|{}]+$/, 'Título no válido.'),
  );

export const wikiSectionSchema = z.object({
  level: z.number(),
  title: z.string(),
  anchor: z.string(),
});

/** Aviso editorial de una página (desactualizada, en construcción, sistema antiguo…). */
export const wikiNoticeSchema = z.object({
  kind: z.enum(['warn', 'build', 'off', 'old']),
  label: z.string(),
  text: z.string(),
});
export type WikiNotice = z.infer<typeof wikiNoticeSchema>;

export const wikiPageSchema = z.object({
  title: z.string(),
  /** Título al que se llegó si la página era una redirección. */
  redirectedFrom: z.string().nullable(),
  revisionId: z.number().nullable(),
  /** HTML ya saneado en la API y con enlaces reescritos a rutas de la app. */
  html: z.string(),
  sections: z.array(wikiSectionSchema),
  categories: z.array(z.string()),
  notice: wikiNoticeSchema.nullable(),
  /** Búsqueda de la página en la wiki original (la app trabaja con una copia local). */
  sourceUrl: z.string(),
});
export type WikiPage = z.infer<typeof wikiPageSchema>;

export const wikiSnippetSchema = z.array(z.object({ text: z.string(), match: z.boolean() }));

export const wikiSearchResponseSchema = z.object({
  query: z.string(),
  titles: z.array(z.string()),
  results: z.array(
    z.object({
      title: z.string(),
      snippet: wikiSnippetSchema,
      updatedAt: z.string().nullable(),
      words: z.number().nullable(),
    }),
  ),
  total: z.number(),
});
export type WikiSearchResponse = z.infer<typeof wikiSearchResponseSchema>;

export const wikiCategoriesResponseSchema = z.object({
  categories: z.array(z.object({ name: z.string(), pages: z.number() })),
});
export type WikiCategoriesResponse = z.infer<typeof wikiCategoriesResponseSchema>;

export const wikiCategoryResponseSchema = z.object({
  name: z.string(),
  pages: z.array(z.string()),
  subcategories: z.array(z.string()),
});
export type WikiCategoryResponse = z.infer<typeof wikiCategoryResponseSchema>;

export const wikiIndexResponseSchema = z.object({ pages: z.array(z.string()) });
export type WikiIndexResponse = z.infer<typeof wikiIndexResponseSchema>;

/** Estado de la copia local de la wiki (se descarga de GitHub la primera vez que se abre la app). */
export const wikiStatusSchema = z.object({
  state: z.enum(['ready', 'downloading', 'error']),
  /** Archivos descargados y totales de la descarga en curso. */
  done: z.number(),
  total: z.number(),
  /** Motivo del último fallo (solo con `state: 'error'`). */
  message: z.string().nullable(),
});
export type WikiStatus = z.infer<typeof wikiStatusSchema>;

export const wikiSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(100),
});

/** Ruta de la app para un título de la wiki. */
export function wikiPath(title: string): string {
  return `/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`;
}

export function wikiCategoryPath(name: string): string {
  return `/wiki/categoria/${encodeURIComponent(name.replace(/ /g, '_'))}`;
}
