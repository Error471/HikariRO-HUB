import type { MarketOffer, MarketShop } from '@hikari-hub/shared';

const MAX_RESULTS = 100;

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Busca por nombre del item o de sus cartas/encantamientos. */
export function findOffers(shops: MarketShop[], query: string): MarketOffer[] {
  const needle = normalizeText(query);
  return shops.flatMap(({ items, ...shop }) =>
    items
      .filter(
        (item) =>
          normalizeText(item.name).includes(needle) ||
          item.extras.some((extra) =>
            extra.entries.some((entry) => normalizeText(entry.name).includes(needle)),
          ),
      )
      .map((item) => ({ item, shop })),
  );
}

export function rankOffers(offers: MarketOffer[], order: 'asc' | 'desc'): MarketOffer[] {
  const direction = order === 'asc' ? 1 : -1;
  return [...offers]
    .sort(
      (a, b) => (a.item.unitPrice - b.item.unitPrice) * direction || b.item.amount - a.item.amount,
    )
    .slice(0, MAX_RESULTS);
}
