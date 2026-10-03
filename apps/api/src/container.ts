import { Redis } from 'ioredis';
import type { Env } from './config/env.js';
import { HikariAuth } from './hikari/hikari-auth.js';
import { HikariClient } from './hikari/hikari-client.js';
import { Sealer } from './lib/crypto.js';
import { AlbumService } from './modules/albums/album.service.js';
import { MemoryLoginThrottle, RedisLoginThrottle } from './modules/auth/login-throttle.js';
import { MarketService } from './modules/markets/market.service.js';
import { MvpService } from './modules/mvp/mvp.service.js';
import { PushService } from './modules/push/push.service.js';
import { WebPushSender } from './modules/push/push-sender.js';
import { NewsService } from './modules/news/news.service.js';
import { WikiService } from './modules/wiki/wiki.service.js';
import { SessionService } from './session/session-service.js';
import { MemorySessionStore, RedisSessionStore } from './session/session-store.js';
import { MemoryUserDataStore, RedisUserDataStore } from './user/user-data-store.js';
import type { AppDependencies } from './app.js';

/** Construye las dependencias reales a partir de la configuración. */
export function createDependencies(env: Env): AppDependencies {
  const redis = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 }) : undefined;
  const throttleOptions = {
    maxAttempts: env.LOGIN_MAX_ATTEMPTS,
    windowMs: env.LOGIN_WINDOW_MINUTES * 60_000,
  };

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

  const sessions = new SessionService(
    redis ? new RedisSessionStore(redis) : new MemorySessionStore(),
    new Sealer(env.SESSION_ENCRYPTION_KEY),
    {
      ttlMs: env.SESSION_TTL_HOURS * 3_600_000,
      revalidateMs: env.SESSION_REVALIDATE_SECONDS * 1000,
    },
  );

  const userData = redis ? new RedisUserDataStore(redis) : new MemoryUserDataStore();
  const sender =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? new WebPushSender({
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT,
        })
      : null;

  return {
    env,
    redis,
    sessions,
    hikariAuth: new HikariAuth(client),
    mvp: new MvpService(client, new URL(env.HIKARI_BASE_URL).origin),
    news: new NewsService(feedClient, feedUrl.pathname + feedUrl.search),
    markets: new MarketService(client, new URL(env.HIKARI_BASE_URL).origin),
    wiki: new WikiService(client, new URL(env.HIKARI_BASE_URL).origin),
    albums: new AlbumService(client, new URL(env.HIKARI_BASE_URL).origin),
    userData,
    push: new PushService(userData, sender),
    loginThrottle: redis
      ? new RedisLoginThrottle(redis, throttleOptions)
      : new MemoryLoginThrottle(throttleOptions),
  };
}
