import {
  marketSearchResponseSchema,
  marketShopResponseSchema,
  marketShopsResponseSchema,
  type MarketShop,
  type MarketType,
} from '@hikari-hub/shared';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

/** La API sirve una instantánea de 60 s; no tiene sentido pedirla más a menudo. */
const MARKET_STALE_MS = 60_000;

export const marketListQuery = (type: MarketType) =>
  queryOptions({
    queryKey: ['markets', type],
    queryFn: ({ signal }) =>
      apiRequest(`/markets/${type}`, { schema: marketShopsResponseSchema, signal }),
    staleTime: MARKET_STALE_MS,
  });

export const marketShopQuery = (type: MarketType, shopId: number) =>
  queryOptions({
    queryKey: ['markets', type, shopId],
    queryFn: ({ signal }) =>
      apiRequest(`/markets/${type}/${shopId}`, { schema: marketShopResponseSchema, signal }),
    staleTime: MARKET_STALE_MS,
  });

export const marketSearchQuery = (query: string) =>
  queryOptions({
    queryKey: ['markets', 'search', query],
    queryFn: ({ signal }) =>
      apiRequest(`/markets/search?q=${encodeURIComponent(query)}`, {
        schema: marketSearchResponseSchema,
        signal,
      }),
    staleTime: MARKET_STALE_MS,
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
  });

export function shopTotals(shop: MarketShop) {
  return shop.items.reduce(
    (totals, item) => ({
      units: totals.units + item.amount,
      value: totals.value + item.amount * item.unitPrice,
    }),
    { units: 0, value: 0 },
  );
}

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
