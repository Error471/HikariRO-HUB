import type { CardAlbumQuery, CardAlbumResponse, FishingAlbumResponse } from '@hikari-hub/shared';
import { isLoginRedirect } from '../../hikari/fluxcp-pages.js';
import type { HikariClient, HikariResponse } from '../../hikari/hikari-client.js';
import { untracked, type UpstreamTracker } from '../../hikari/upstream-monitor.js';
import { AppError } from '../../lib/app-error.js';
import type { CookieJar } from '../../lib/cookie-jar.js';
import { TtlCache } from '../../lib/ttl-cache.js';
import { parseCardAlbum, parseFishingAlbum } from './album-parser.js';

const CACHE_TTL_MS = 5 * 60_000;
const CARDS_PER_PAGE = 20;

function assertAlbumPage(response: HikariResponse): string {
  if (isLoginRedirect(response)) throw new AppError('SESSION_EXPIRED');
  if (response.status !== 200) throw new AppError('UPSTREAM_UNAVAILABLE');
  return response.body;
}

/**
 * Álbumes de la cuenta (requieren la sesión del usuario). Las cartas se piden página a
 * página con los mismos filtros de HikariRO: no se descargan las 74 páginas de golpe.
 */
export class AlbumService {
  private readonly cards = new TtlCache<CardAlbumResponse>(CACHE_TTL_MS, 1000);
  private readonly fishing = new TtlCache<FishingAlbumResponse>(CACHE_TTL_MS, 500);

  constructor(
    private readonly client: HikariClient,
    private readonly baseUrl: string,
    private readonly monitor: UpstreamTracker = untracked,
  ) {}

  cardPage(username: string, query: CardAlbumQuery, jar: CookieJar): Promise<CardAlbumResponse> {
    const key = [
      username.toLowerCase(),
      query.status,
      query.sort,
      query.q.toLowerCase(),
      query.page,
    ].join('|');
    return this.cards.get(key, async () => {
      const params = new URLSearchParams({
        module: 'cartaslog',
        type_order: query.sort === 'name' ? '1' : '0',
        status: query.status,
      });
      if (query.q) params.set('q', query.q);
      if (query.page > 1) params.set('p', String(query.page));

      const parsed = await this.monitor.track('cards', async () =>
        parseCardAlbum(
          assertAlbumPage(await this.client.get(`/?${params.toString()}`, jar)),
          this.baseUrl,
        ),
      );
      return {
        ...parsed,
        // HikariRO devuelve la última página si se pide una mayor.
        page: Math.max(1, Math.min(query.page, parsed.pages)),
        pages: Math.max(parsed.pages, 0),
        pageSize: CARDS_PER_PAGE,
      };
    });
  }

  fishingAlbum(username: string, jar: CookieJar): Promise<FishingAlbumResponse> {
    return this.fishing.get(username.toLowerCase(), async () => {
      return this.monitor.track('fishing', async () =>
        parseFishingAlbum(
          assertAlbumPage(await this.client.get('/?module=fishingalbum', jar)),
          this.baseUrl,
        ),
      );
    });
  }
}
