import {
  wikiCategoriesResponseSchema,
  wikiCategoryResponseSchema,
  wikiIndexResponseSchema,
  wikiPageSchema,
  wikiSearchResponseSchema,
  wikiStatusSchema,
} from '@hikari-hub/shared';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

const WIKI_STALE_MS = 10 * 60_000;

/** Estado de la descarga de la wiki; se consulta cada segundo mientras dura. */
export const wikiStatusQuery = queryOptions({
  queryKey: ['wiki', 'status'],
  queryFn: ({ signal }) => apiRequest('/wiki/status', { schema: wikiStatusSchema, signal }),
  refetchInterval: (query) => (query.state.data?.state === 'downloading' ? 1000 : false),
  staleTime: (query) => (query.state.data?.state === 'ready' ? Infinity : 0),
});

export const wikiPageQuery = (title: string) =>
  queryOptions({
    queryKey: ['wiki', 'page', title],
    queryFn: ({ signal }) =>
      apiRequest(`/wiki/page?title=${encodeURIComponent(title)}`, {
        schema: wikiPageSchema,
        signal,
      }),
    staleTime: WIKI_STALE_MS,
  });

export const wikiSearchQuery = (query: string) =>
  queryOptions({
    queryKey: ['wiki', 'search', query],
    queryFn: ({ signal }) =>
      apiRequest(`/wiki/search?q=${encodeURIComponent(query)}`, {
        schema: wikiSearchResponseSchema,
        signal,
      }),
    staleTime: 2 * 60_000,
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
  });

export const wikiCategoriesQuery = queryOptions({
  queryKey: ['wiki', 'categories'],
  queryFn: ({ signal }) =>
    apiRequest('/wiki/categories', { schema: wikiCategoriesResponseSchema, signal }),
  staleTime: WIKI_STALE_MS,
});

export const wikiCategoryQuery = (name: string) =>
  queryOptions({
    queryKey: ['wiki', 'category', name],
    queryFn: ({ signal }) =>
      apiRequest(`/wiki/categories/${encodeURIComponent(name)}`, {
        schema: wikiCategoryResponseSchema,
        signal,
      }),
    staleTime: WIKI_STALE_MS,
  });

export const wikiIndexQuery = queryOptions({
  queryKey: ['wiki', 'index'],
  queryFn: ({ signal }) => apiRequest('/wiki/index', { schema: wikiIndexResponseSchema, signal }),
  staleTime: WIKI_STALE_MS,
});

/** Segmento de URL (/wiki/Sistema_de_pesca) → título de MediaWiki. */
export function titleFromPath(segment: string): string {
  try {
    return decodeURIComponent(segment).replace(/_/g, ' ').trim();
  } catch {
    return segment.replace(/_/g, ' ').trim();
  }
}
