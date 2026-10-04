import cookie from '@fastify/cookie';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Env } from './config/env.js';
import type { HikariAuth } from './hikari/hikari-auth.js';
import { accountRoutes } from './modules/account/account.routes.js';
import { alertRoutes } from './modules/alerts/alerts.routes.js';
import type { AlertService } from './modules/alerts/alerts.service.js';
import { albumRoutes } from './modules/albums/album.routes.js';
import type { AlbumService } from './modules/albums/album.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import type { LoginThrottle } from './modules/auth/login-throttle.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { marketRoutes } from './modules/markets/market.routes.js';
import type { MarketService } from './modules/markets/market.service.js';
import { mvpRoutes } from './modules/mvp/mvp.routes.js';
import type { MvpService } from './modules/mvp/mvp.service.js';
import { newsRoutes } from './modules/news/news.routes.js';
import type { NewsService } from './modules/news/news.service.js';
import { wikiRoutes } from './modules/wiki/wiki.routes.js';
import type { WikiService } from './modules/wiki/wiki.service.js';
import { registerErrorHandling } from './plugins/error-handler.js';
import { registerSecurity } from './plugins/security.js';
import { createSpaFallback, registerWebApp } from './plugins/web-app.js';
import {
  createRequireSession,
  registerSessionGuard,
  SessionCookie,
} from './plugins/session-guard.js';
import type { SessionService } from './session/session-service.js';
import { UpstreamSession } from './session/upstream-session.js';
import type { UserDataStore } from './user/user-data-store.js';

export interface AppDependencies {
  env: Env;
  hikariAuth: HikariAuth;
  sessions: SessionService;
  loginThrottle: LoginThrottle;
  mvp: MvpService;
  news: NewsService;
  markets: MarketService;
  wiki: WikiService;
  albums: AlbumService;
  userData: UserDataStore;
  alerts: AlertService;
}

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'test') return false;
  return {
    level: env.LOG_LEVEL,
    ...(env.LOG_FILE && { file: env.LOG_FILE }),
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["x-csrf-token"]',
        'res.headers["set-cookie"]',
        'password',
        '*.password',
      ],
      censor: '[redacted]',
    },
    ...(env.NODE_ENV === 'development' &&
      !env.LOG_FILE && { transport: { target: 'pino-pretty' } }),
  };
}

export async function buildApp(deps: AppDependencies) {
  const { env } = deps;
  const app = Fastify({
    logger: loggerOptions(env),
    bodyLimit: 16 * 1024,
  });

  registerErrorHandling(app, {
    spaFallback: env.WEB_DIST_DIR ? createSpaFallback(env.WEB_DIST_DIR) : undefined,
  });
  await registerSecurity(app, {
    appOrigin: env.APP_ORIGIN,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  registerSessionGuard(app);

  const ttlMs = env.SESSION_TTL_HOURS * 3_600_000;
  const sessionCookie = new SessionCookie({ secure: env.COOKIE_SECURE, ttlMs });
  const requireSession = createRequireSession(deps.sessions, sessionCookie);
  const auth = new AuthService(deps.hikariAuth, deps.sessions, deps.loginThrottle);

  await app.register(healthRoutes, {
    prefix: '/api',
    privacyContact: env.PRIVACY_CONTACT,
    rememberAvailable: deps.sessions.canRemember,
  });
  await app.register(authRoutes, {
    prefix: '/api/auth',
    auth,
    cookie: sessionCookie,
    requireSession,
    sessionEvents: deps.alerts,
    loginRateLimit: {
      max: env.LOGIN_MAX_ATTEMPTS * 2,
      timeWindowMs: env.LOGIN_WINDOW_MINUTES * 60_000,
    },
  });

  const upstream = new UpstreamSession(deps.sessions, sessionCookie);
  await app.register(mvpRoutes, {
    prefix: '/api/mvp',
    mvp: deps.mvp,
    upstream,
    userData: deps.userData,
    requireSession,
  });
  await app.register(accountRoutes, {
    prefix: '/api/account',
    auth,
    userData: deps.userData,
    cookie: sessionCookie,
    requireSession,
  });
  await app.register(alertRoutes, {
    prefix: '/api/alerts',
    alerts: deps.alerts,
    requireSession,
  });
  await app.register(newsRoutes, { prefix: '/api/news', news: deps.news, requireSession });
  await app.register(marketRoutes, {
    prefix: '/api/markets',
    markets: deps.markets,
    requireSession,
  });
  await app.register(wikiRoutes, { prefix: '/api/wiki', wiki: deps.wiki, requireSession });
  await app.register(albumRoutes, {
    prefix: '/api/albums',
    albums: deps.albums,
    upstream,
    requireSession,
  });

  if (env.WEB_DIST_DIR) await registerWebApp(app, env.WEB_DIST_DIR);

  return app;
}
