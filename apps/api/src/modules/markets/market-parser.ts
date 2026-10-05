import type { MarketItem, MarketShop, MarketType } from '@hikari-hub/shared';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { AppError } from '../../lib/app-error.js';

/** Rutas de FluxCP por tipo de mercado (observadas el 03/10/2026). */
export const marketModules: Record<MarketType, string> = {
  vending: 'vending',
  buying: 'buyingstore',
};

export type ShopSummary = Omit<MarketShop, 'items'>;

/** "10.000.000 z" → 10000000; "x5414" → 5414. */
export function parseNumber(text: string | undefined): number | null {
  const digits = (text ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

function idFromHref(href: string | undefined, param = 'id'): number | null {
  if (!href) return null;
  try {
    const value = new URL(href, 'https://placeholder.invalid').searchParams.get(param);
    return value && /^\d+$/.test(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseCoords(text: string): { x: number | null; y: number | null } {
  const match = /(\d+)\s*,\s*(\d+)/.exec(text);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: null, y: null };
}

export function shopSourceUrl(baseUrl: string, type: MarketType, id: number): string {
  return `${baseUrl}/?module=${marketModules[type]}&action=viewshop&id=${id}`;
}

/** Total de páginas indicado por FluxCP ("... en N página(s)"). */
export function parsePageCount(html: string): number {
  const match = /en\s+(\d+)\s+página/i.exec(cheerio.load(html)('.hro-shop-toolbar').text());
  return match ? Math.max(1, Number(match[1])) : 1;
}

/** Hay tarjetas de tienda pero ninguna se entiende: HikariRO ha cambiado su HTML. */
function assertRecognized(found: number, parsed: number): void {
  if (found > 0 && parsed === 0) throw new AppError('UPSTREAM_CHANGED');
}

export function parseShopList(html: string, type: MarketType, baseUrl: string): ShopSummary[] {
  const $ = cheerio.load(html);
  const cards = $('.hro-shop-card').toArray();
  const shops = cards.flatMap((card) => {
    const link = $(card).find('h3 a').first();
    const id = idFromHref(link.attr('href'));
    if (id === null) return [];
    const meta = $(card).find('.hro-shop-card__meta span');
    return [
      {
        id,
        type,
        title: clean(link.text()),
        owner: clean($(card).find('.hro-shop-owner').text()),
        map: clean(meta.eq(0).text()),
        ...parseCoords(meta.eq(1).text()),
        sourceUrl: shopSourceUrl(baseUrl, type, id),
      },
    ];
  });
  assertRecognized(cards.length, shops.length);
  return shops;
}

function tagNumber($: cheerio.CheerioAPI, item: AnyNode, icon: string): number | null {
  const tag = $(item)
    .find('.hro-item-tags span')
    .filter((_, span) => $(span).find(`i.${icon}`).length > 0)
    .first();
  return tag.length ? parseNumber(tag.text()) : null;
}

function parseExtras($: cheerio.CheerioAPI, item: AnyNode): MarketItem['extras'] {
  return $(item)
    .find('.hro-item-extra')
    .toArray()
    .map((extra) => ({
      label: clean($(extra).children('strong').first().text()) || 'Extras',
      entries: $(extra)
        .children('span')
        .toArray()
        .map((span) => ({
          itemId: idFromHref($(span).find('a').attr('href')),
          name: clean($(span).text()),
        }))
        .filter((entry) => entry.name),
    }))
    .filter((extra) => extra.entries.length > 0);
}

function parseItem($: cheerio.CheerioAPI, item: AnyNode, baseUrl: string): MarketItem | null {
  const link = $(item).find('.hro-market-item__body h3 a').first();
  const itemId = idFromHref(link.attr('href')) ?? parseNumber($(item).find('.hro-item-id').text());
  const unitPrice = parseNumber($(item).find('.hro-market-item__price strong').first().text());
  if (itemId === null || unitPrice === null) return null;

  const amount =
    parseNumber($(item).find('.hro-amount').text()) ??
    tagNumber($, item, 'fa-cubes') ??
    tagNumber($, item, 'fa-shopping-basket') ??
    1;

  return {
    itemId,
    name: clean(link.text()),
    iconUrl: `${baseUrl}/data/items/icons/${itemId}.png`,
    detailUrl: `${baseUrl}/?module=item&action=view&id=${itemId}`,
    refine: parseNumber($(item).find('.hro-refine').text()),
    slots: tagNumber($, item, 'fa-circle-o'),
    amount,
    unitPrice,
    extras: parseExtras($, item),
  };
}

/** Devuelve `null` si la tienda ya no existe ("Vendedor no encontrado"). */
export function parseShopDetail(html: string, baseUrl: string): MarketItem[] | null {
  const $ = cheerio.load(html);
  if ($('.hro-shop-detail').length === 0) return null;
  const nodes = $('.hro-market-item').toArray();
  const items = nodes.flatMap((item) => parseItem($, item, baseUrl) ?? []);
  assertRecognized(nodes.length, items.length);
  return items;
}

/** El listado debe contener la estructura de tiendas aunque esté vacío. */
export function isShopListPage(html: string): boolean {
  return cheerio.load(html)('.hro-shops').length > 0;
}
