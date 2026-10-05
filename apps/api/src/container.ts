import { join } from 'node:path';
import type { Env } from './config/env.js';
import { HikariAuth } from './hikari/hikari-auth.js';
import { HikariClient } from './hikari/hikari-client.js';
import { UpstreamMonitor } from './hikari/upstream-monitor.js';
import { Sealer } from './lib/crypto.js';
import { ErrorJournal } from './lib/error-journal.js';
import { AlbumService } from './modules/albums/album.service.js';
import { AlertService } from './modules/alerts/alerts.service.js';
import type { Notifier } from './modules/alerts/notifier.js';
import { TelegramClient } from './modules/alerts/telegram-client.js';
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
  /** Muestra las notificaciones de Windows; sin él solo hay avisos por Telegram. */
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

  const monitor = new UpstreamMonitor();
  const hikariAuth = new HikariAuth(client, monitor);
  const dataDir = env.DATA_DIR;
  const sealer = new Sealer(env.SESSION_ENCRYPTION_KEY);
  const sessions = new SessionService(
    dataDir ? new FileSessionStore(join(dataDir, 'sessions.json')) : new MemorySessionStore(),
    sealer,
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
    monitor,
    journal: new ErrorJournal(),
    mvp: new MvpService(client, origin, monitor),
    news: new NewsService(feedClient, feedUrl.pathname + feedUrl.search, monitor),
    markets: new MarketService(client, origin, { monitor }),
    wiki: new WikiService(client, origin, monitor),
    albums: new AlbumService(client, origin, monitor),
    userData,
    alerts: new AlertService(
      userData,
      options.notifier ?? null,
      new TelegramClient({ baseUrl: env.TELEGRAM_API_URL, timeoutMs: env.HIKARI_TIMEOUT_MS }),
      sealer,
    ),
    loginThrottle: new MemoryLoginThrottle({
      maxAttempts: env.LOGIN_MAX_ATTEMPTS,
      windowMs: env.LOGIN_WINDOW_MINUTES * 60_000,
    }),
  };
}
