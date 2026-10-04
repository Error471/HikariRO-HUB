import type { Mvp, MvpListResponse } from '@hikari-hub/shared';
import { z } from 'zod';
import { fluxRoutes } from '../../hikari/fluxcp-pages.js';
import type { HikariClient } from '../../hikari/hikari-client.js';
import { parseUpstreamJson } from '../../hikari/upstream-json.js';
import type { CookieJar } from '../../lib/cookie-jar.js';
import { TtlCache } from '../../lib/ttl-cache.js';

/** Formato de `?module=mvptimer&ajax=1` observado el 03/10/2026. */
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
});
type UpstreamMvpData = z.infer<typeof upstreamSchema>;

const CACHE_TTL_MS = 10_000;

export class MvpService {
  private readonly cache = new TtlCache<{ data: MvpListResponse; fetchedAtMs: number }>(
    CACHE_TTL_MS,
  );

  constructor(
    private readonly client: HikariClient,
    private readonly hikariBaseUrl: string,
  ) {}

  /** Cache por cuenta: no está verificado que todas las cuentas reciban los mismos datos. */
  async list(username: string, jar: CookieJar): Promise<MvpListResponse> {
    const { data, fetchedAtMs } = await this.cache.get(username.toLowerCase(), async () => {
      const response = await this.client.get(fluxRoutes.mvpTimerData, jar);
      return {
        data: this.toResponse(parseUpstreamJson(response, upstreamSchema)),
        fetchedAtMs: Date.now(),
      };
    });
    // La hora del servidor avanza mientras la respuesta está en cache.
    return { ...data, serverNow: data.serverNow + (Date.now() - fetchedAtMs) / 1000 };
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
