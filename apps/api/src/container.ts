import { join } from 'node:path';
import type { Env } from './config/env.js';
import { HikariAuth } from './hikari/hikari-auth.js';
import { HikariClient } from './hikari/hikari-client.js';
import { Sealer } from './lib/crypto.js';
import { AlbumService } from './modules/albums/album.service.js';
import { AlertService } from './modules/alerts/alerts.service.js';
import type { Notifier } from './modules/alerts/notifier.js';
import { MemoryLoginThrottle } from './modules/auth/login-throttle.js';
import { MarketService } from './modules/markets/market.service.js';
import { MvpService } from './modules/mvp/mvp.service.js';
import { NewsService } from './modules/news/news.service.js';
import { WikiService } from './modules/wiki/wiki.service.js';
import { SessionService } from './session/session-service.js';
import { FileSessionStore, MemorySessionStore } from './session/session-store.js';
import { FileUserDataStore, MemoryUserDataStore } from './user/user-data-store.js';
import type { AppDependencies } from './app.js';

export interface ContainerOptions {
  /** Muestra los avisos de MVP; sin él los avisos no están disponibles. */
  notifier?: Notifier | null;
}

/** Construye las dependencias reales a partir de la configuración. */
export function createDependencies(env: Env, options: ContainerOptions = {}): AppDependencies {
  const client = new HikariClient({
    baseUrl: env.HIKARI_BASE_URL,
    userAgent: env.HIKARI_USER_AGENT,
    timeoutMs: env.HIKARI_TIMEOUT_MS,
  });

  const feedUrl = new URL(env.HIKARI_NEWS_FEED_URL);
  const feedClient = new HikariClient({
    baseUrl: feedUrl.origin,
    userAgent: env.HIKARI_USER_AGENT,
    timeoutMs: env.HIKARI_TIMEOUT_MS,
  });

  const hikariAuth = new HikariAuth(client);
  const dataDir = env.DATA_DIR;
  const sessions = new SessionService(
    dataDir ? new FileSessionStore(join(dataDir, 'sessions.json')) : new MemorySessionStore(),
    new Sealer(env.SESSION_ENCRYPTION_KEY),
    {
      ttlMs: env.SESSION_TTL_HOURS * 3_600_000,
      revalidateMs: env.SESSION_REVALIDATE_SECONDS * 1000,
      ...(env.ALLOW_REMEMBER && {
        relogin: (username: string, password: string) => hikariAuth.login(username, password),
      }),
    },
  );
  const userData = dataDir
    ? new FileUserDataStore(join(dataDir, 'user-data.json'))
    : new MemoryUserDataStore();
  const origin = new URL(env.HIKARI_BASE_URL).origin;

  return {
    env,
    sessions,
    hikariAuth,
    mvp: new MvpService(client, origin),
    news: new NewsService(feedClient, feedUrl.pathname + feedUrl.search),
    markets: new MarketService(client, origin),
    wiki: new WikiService(client, origin),
    albums: new AlbumService(client, origin),
    userData,
    alerts: new AlertService(userData, options.notifier ?? null),
    loginThrottle: new MemoryLoginThrottle({
      maxAttempts: env.LOGIN_MAX_ATTEMPTS,
      windowMs: env.LOGIN_WINDOW_MINUTES * 60_000,
    }),
  };
}
