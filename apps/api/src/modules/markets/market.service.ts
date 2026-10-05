import type {
  MarketSearchResponse,
  MarketShop,
  MarketShopResponse,
  MarketShopsResponse,
  MarketType,
} from '@hikari-hub/shared';
import type { HikariClient } from '../../hikari/hikari-client.js';
import { untracked, type UpstreamTracker } from '../../hikari/upstream-monitor.js';
import { AppError } from '../../lib/app-error.js';
import { mapLimit } from '../../lib/map-limit.js';
import { TtlCache } from '../../lib/ttl-cache.js';
import {
  isShopListPage,
  marketModules,
  parsePageCount,
  parseShopDetail,
  parseShopList,
  type ShopSummary,
} from './market-parser.js';
import { findOffers, rankOffers } from './market-search.js';

interface MarketSnapshot {
  updatedAt: string;
  fetchedAtMs: number;
  markets: Record<MarketType, MarketShop[]>;
}

export interface MarketServiceOptions {
  ttlMs?: number;
  concurrency?: number;
  maxPages?: number;
  /** Tiempo durante el que se sirve la última instantánea si HikariRO falla. */
  staleMs?: number;
  monitor?: UpstreamTracker;
}

/**
 * HikariRO no ofrece búsqueda fiable ni API de mercados: se construye una instantánea
 * de todas las tiendas (listado + detalle de cada una) y se reutiliza durante `ttlMs`.
 */
export class MarketService {
  private readonly cache: TtlCache<MarketSnapshot>;
  private readonly concurrency: number;
  private readonly maxPages: number;
  private readonly staleMs: number;
  private readonly monitor: UpstreamTracker;
  private lastGood: MarketSnapshot | null = null;

  constructor(
    private readonly client: HikariClient,
    private readonly baseUrl: string,
    options: MarketServiceOptions = {},
  ) {
    this.cache = new TtlCache(options.ttlMs ?? 60_000, 1);
    this.concurrency = options.concurrency ?? 3;
    this.maxPages = options.maxPages ?? 10;
    this.staleMs = options.staleMs ?? 10 * 60_000;
    this.monitor = options.monitor ?? untracked;
  }

  async list(type: MarketType): Promise<MarketShopsResponse> {
    const snapshot = await this.snapshot();
    return { type, updatedAt: snapshot.updatedAt, shops: snapshot.markets[type] };
  }

  async shop(type: MarketType, id: number): Promise<MarketShopResponse> {
    const snapshot = await this.snapshot();
    const shop = snapshot.markets[type].find((candidate) => candidate.id === id);
    if (!shop) {
      throw new AppError('NOT_FOUND', {
        publicMessage: 'La tienda puede haberse cerrado o ya no estar disponible.',
      });
    }
    return { updatedAt: snapshot.updatedAt, shop };
  }

  async search(query: string): Promise<MarketSearchResponse> {
    const snapshot = await this.snapshot();
    return {
      query,
      updatedAt: snapshot.updatedAt,
      vending: rankOffers(findOffers(snapshot.markets.vending, query), 'asc'),
      buying: rankOffers(findOffers(snapshot.markets.buying, query), 'desc'),
    };
  }

  private async snapshot(): Promise<MarketSnapshot> {
    try {
      return await this.cache.get('markets', () =>
        this.monitor.track('markets', () => this.build()),
      );
    } catch (error) {
      if (this.lastGood && Date.now() - this.lastGood.fetchedAtMs < this.staleMs)
        return this.lastGood;
      throw error;
    }
  }

  private async build(): Promise<MarketSnapshot> {
    const [vending, buying] = await Promise.all([
      this.loadMarket('vending'),
      this.loadMarket('buying'),
    ]);
    const snapshot = {
      updatedAt: new Date().toISOString(),
      fetchedAtMs: Date.now(),
      markets: { vending, buying },
    };
    this.lastGood = snapshot;
    return snapshot;
  }

  private async loadMarket(type: MarketType): Promise<MarketShop[]> {
    const summaries = await this.loadSummaries(type);
    const results = await mapLimit(summaries, this.concurrency, (summary) =>
      this.loadShop(summary),
    );

    const shops = results.flatMap((result) =>
      result.status === 'fulfilled' && result.value ? [result.value] : [],
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (summaries.length > 0 && failures.length === summaries.length) {
      throw (failures[0] as PromiseRejectedResult).reason;
    }
    return shops;
  }

  private async loadSummaries(type: MarketType): Promise<ShopSummary[]> {
    const firstPage = await this.fetchPage(type, 1);
    const pages = Math.min(parsePageCount(firstPage), this.maxPages);
    const rest = await mapLimit(
      Array.from({ length: pages - 1 }, (_, index) => index + 2),
      this.concurrency,
      (page) => this.fetchPage(type, page),
    );

    const html = [firstPage, ...rest.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))];
    const seen = new Set<number>();
    return html
      .flatMap((page) => parseShopList(page, type, this.baseUrl))
      .filter((shop) => !seen.has(shop.id) && seen.add(shop.id));
  }

  private async fetchPage(type: MarketType, page: number): Promise<string> {
    const suffix = page > 1 ? `&p=${page}` : '';
    const response = await this.client.get(`/?module=${marketModules[type]}${suffix}`);
    if (response.status !== 200) throw new AppError('UPSTREAM_UNAVAILABLE');
    if (!isShopListPage(response.body)) throw new AppError('UPSTREAM_CHANGED');
    return response.body;
  }

  private async loadShop(summary: ShopSummary): Promise<MarketShop | null> {
    const response = await this.client.get(
      `/?module=${marketModules[summary.type]}&action=viewshop&id=${summary.id}`,
    );
    if (response.status !== 200) throw new AppError('UPSTREAM_UNAVAILABLE');
    const items = parseShopDetail(response.body, this.baseUrl);
    return items ? { ...summary, items } : null;
  }
}
