import type { Mvp, MvpListResponse } from '@hikari-hub/shared';
import { z } from 'zod';
import { fluxRoutes } from '../../hikari/fluxcp-pages.js';
import type { HikariClient } from '../../hikari/hikari-client.js';
import { parseUpstreamJson } from '../../hikari/upstream-json.js';
import { untracked, type UpstreamTracker } from '../../hikari/upstream-monitor.js';
import type { CookieJar } from '../../lib/cookie-jar.js';
import { TtlCache } from '../../lib/ttl-cache.js';

/**
 * Formato de `?module=mvptimer&ajax=1` observado el 03/10/2026. Desde noviembre de 2026 la web lo pagina
 * (20 por página): la respuesta añade `page`, `pages` y `total`, y las demás páginas se piden con `&page=N`.
 */
const upstreamSchema = z.object({
  rows: z.array(
    z.object({
      id: z.coerce.number().int(),
      name: z.string(),
      map: z.string(),
      killed_at: z.number().nullable(),
      min_at: z.number().nullable(),
      max_at: z.number().nullable(),
    }),
  ),
  server_now: z.number(),
  page: z.number().int().optional(),
  pages: z.number().int().optional(),
  total: z.number().int().optional(),
});
type UpstreamMvpData = z.infer<typeof upstreamSchema>;

const CACHE_TTL_MS = 10_000;
/** Tope de seguridad por si la web devolviera un número de páginas absurdo. */
const MAX_PAGES = 30;

export class MvpService {
  private readonly cache = new TtlCache<{ data: MvpListResponse; fetchedAtMs: number }>(
    CACHE_TTL_MS,
  );

  constructor(
    private readonly client: HikariClient,
    private readonly hikariBaseUrl: string,
    private readonly monitor: UpstreamTracker = untracked,
  ) {}

  /** Cache por cuenta: no está verificado que todas las cuentas reciban los mismos datos. */
  async list(username: string, jar: CookieJar): Promise<MvpListResponse> {
    const { data, fetchedAtMs } = await this.cache.get(username.toLowerCase(), async () => {
      const upstream = await this.monitor.track('mvp', () => this.fetchAllPages(jar));
      return {
        data: this.toResponse(upstream),
        fetchedAtMs: Date.now(),
      };
    });
    // La hora del servidor avanza mientras la respuesta está en cache.
    return { ...data, serverNow: data.serverNow + (Date.now() - fetchedAtMs) / 1000 };
  }

  /** La primera página se pide sin `page` (como siempre) y las siguientes con `&page=N`. */
  private async fetchAllPages(jar: CookieJar): Promise<UpstreamMvpData> {
    const read = async (path: string) =>
      parseUpstreamJson(await this.client.get(path, jar), upstreamSchema);

    const first = await read(fluxRoutes.mvpTimerData);
    const pages = Math.min(first.pages ?? 1, MAX_PAGES);
    const rows = [...first.rows];
    // En serie: son pocas páginas y así no se satura la web de HikariRO.
    for (let page = 2; page <= pages; page += 1) {
      rows.push(...(await read(`${fluxRoutes.mvpTimerData}&page=${page}`)).rows);
    }
    // Si alguien muere mientras se leen las páginas, un MVP puede cambiar de página y repetirse.
    const unique = new Map(rows.map((row) => [`${row.id}|${row.name}|${row.map}`, row]));
    return { ...first, rows: [...unique.values()] };
  }

  private toResponse(data: UpstreamMvpData): MvpListResponse {
    const groups = new Map<string, Mvp>();
    for (const row of data.rows) {
      const key = `${row.id}|${row.name}`;
      let mvp = groups.get(key);
      if (!mvp) {
        mvp = {
          id: row.id,
          name: row.name,
          imageUrl: `${this.hikariBaseUrl}/data/monsters/${row.id}.gif`,
          detailUrl: `${this.hikariBaseUrl}/?module=monster&action=view&id=${row.id}`,
          spawns: [],
        };
        groups.set(key, mvp);
      }
      mvp.spawns.push({
        map: row.map,
        killedAt: row.killed_at,
        minAt: row.min_at,
        maxAt: row.max_at,
      });
    }
    return { serverNow: data.server_now, mvps: [...groups.values()] };
  }
}
