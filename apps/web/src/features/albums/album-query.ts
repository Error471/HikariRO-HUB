import {
  cardAlbumResponseSchema,
  fishingAlbumResponseSchema,
  type CardSort,
  type CardStatus,
} from '@hrc/shared';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

const ALBUM_STALE_MS = 5 * 60_000;

export interface CardAlbumParams {
  status: CardStatus;
  sort: CardSort;
  q: string;
  page: number;
}

export const cardAlbumQuery = (params: CardAlbumParams) =>
  queryOptions({
    queryKey: ['albums', 'cards', params],
    queryFn: ({ signal }) => {
      const search = new URLSearchParams({
        status: params.status,
        sort: params.sort,
        page: String(params.page),
      });
      if (params.q) search.set('q', params.q);
      return apiRequest(`/albums/cards?${search.toString()}`, {
        schema: cardAlbumResponseSchema,
        signal,
      });
    },
    staleTime: ALBUM_STALE_MS,
    placeholderData: keepPreviousData,
  });

export const fishingAlbumQuery = queryOptions({
  queryKey: ['albums', 'fishing'],
  queryFn: ({ signal }) =>
    apiRequest('/albums/fishing', { schema: fishingAlbumResponseSchema, signal }),
  staleTime: ALBUM_STALE_MS,
});
