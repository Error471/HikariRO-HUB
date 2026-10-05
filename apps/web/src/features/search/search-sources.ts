import type { MarketSearchResponse, Mvp } from '@hikari-hub/shared';
import { normalizeText } from '@/features/markets/market-query';

const words = (text: string) =>
  normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Cada palabra buscada debe ser el principio de alguna palabra del texto (sin tildes ni mayúsculas). */
export function matches(text: string, query: string): boolean {
  const haystack = words(text);
  const needles = words(query);
  return (
    needles.length > 0 &&
    needles.every((needle) => haystack.some((word) => word.startsWith(needle)))
  );
}

/** Primero lo que empieza por la búsqueda, luego el resto, en orden alfabético. */
function sortByRelevance<T>(values: T[], text: (value: T) => string, query: string): T[] {
  const needle = normalizeText(query);
  const starts = (value: T) => (normalizeText(text(value)).startsWith(needle) ? 0 : 1);
  return [...values].sort((a, b) => starts(a) - starts(b) || text(a).localeCompare(text(b), 'es'));
}

const rank = (texts: string[], query: string) => sortByRelevance(texts, (text) => text, query);

export interface MvpResult {
  id: number;
  name: string;
  imageUrl: string;
  maps: string[];
}

export function searchMvps(mvps: Mvp[], query: string, limit = 5): MvpResult[] {
  if (!query.trim()) return [];
  const byName = new Map<string, MvpResult>();
  for (const mvp of mvps) {
    const maps = mvp.spawns.map((spawn) => spawn.map);
    if (!matches(`${mvp.name} ${maps.join(' ')}`, query)) continue;
    const existing = byName.get(mvp.name);
    if (existing) existing.maps.push(...maps);
    else byName.set(mvp.name, { id: mvp.id, name: mvp.name, imageUrl: mvp.imageUrl, maps });
  }
  return rank([...byName.keys()], query)
    .slice(0, limit)
    .flatMap((name) => byName.get(name) ?? []);
}

export function searchTitles(titles: string[], query: string, limit = 6): string[] {
  if (!query.trim()) return [];
  return rank(
    titles.filter((title) => matches(title, query)),
    query,
  ).slice(0, limit);
}

export interface ItemResult {
  itemId: number;
  name: string;
  iconUrl: string;
  /** Precio de venta más barato. */
  lowestSell: number | null;
  /** Mejor precio de compra. */
  highestBuy: number | null;
}

/** Objetos distintos encontrados en los mercados, con su mejor precio. */
export function summarizeItems(data: MarketSearchResponse, limit = 5): ItemResult[] {
  const items = new Map<number, ItemResult>();
  const entry = (offer: MarketSearchResponse['vending'][number]) => {
    const existing = items.get(offer.item.itemId);
    if (existing) return existing;
    const created: ItemResult = {
      itemId: offer.item.itemId,
      name: offer.item.name,
      iconUrl: offer.item.iconUrl,
      lowestSell: null,
      highestBuy: null,
    };
    items.set(offer.item.itemId, created);
    return created;
  };
  for (const offer of data.vending) {
    const item = entry(offer);
    item.lowestSell = Math.min(item.lowestSell ?? Infinity, offer.item.unitPrice);
  }
  for (const offer of data.buying) {
    const item = entry(offer);
    item.highestBuy = Math.max(item.highestBuy ?? 0, offer.item.unitPrice);
  }
  return sortByRelevance([...items.values()], (item) => item.name, data.query).slice(0, limit);
}
