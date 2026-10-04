import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { MockAgent } from 'undici';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { HikariAuth } from '../src/hikari/hikari-auth.js';
import { HikariClient } from '../src/hikari/hikari-client.js';
import { Sealer } from '../src/lib/crypto.js';
import { AlbumService } from '../src/modules/albums/album.service.js';
import { MemoryLoginThrottle } from '../src/modules/auth/login-throttle.js';
import { MarketService } from '../src/modules/markets/market.service.js';
import { MvpService } from '../src/modules/mvp/mvp.service.js';
import { NewsService } from '../src/modules/news/news.service.js';
import { WikiService } from '../src/modules/wiki/wiki.service.js';
import { AlertService } from '../src/modules/alerts/alerts.service.js';
import type { Notifier } from '../src/modules/alerts/notifier.js';
import { SessionService } from '../src/session/session-service.js';
import { MemorySessionStore } from '../src/session/session-store.js';
import { MemoryUserDataStore } from '../src/user/user-data-store.js';

export const HIKARI = 'https://hikariro.test';
export const APP_ORIGIN = 'https://hub.test';
export const NEWS_FEED = 'https://api.hikariro.test';

export const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

export const testEnv = loadEnv({
  NODE_ENV: 'test',
  APP_ORIGIN,
  HIKARI_BASE_URL: HIKARI,
  SESSION_SECRET: 'x'.repeat(48),
  SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  SESSION_REVALIDATE_SECONDS: '300',
  LOGIN_MAX_ATTEMPTS: '3',
});

export function createMockHikari() {
  const agent = new MockAgent();
  agent.disableNetConnect();
  return { agent, pool: agent.get(HIKARI), newsPool: agent.get(NEWS_FEED) };
}

export async function createTestApp(
  agent: MockAgent,
  {
    notifier = null,
    webDir,
    remember = false,
    revalidateMs = 300_000,
    env = {},
  }: {
    /** Cambios sobre la configuración de prueba. */
    env?: Partial<typeof testEnv>;
    notifier?: Notifier | null;
    webDir?: string;
    /** Activa "Mantener la sesión iniciada" (como en la app de escritorio). */
    remember?: boolean;
    revalidateMs?: number;
  } = {},
) {
  const client = new HikariClient({
    baseUrl: HIKARI,
    userAgent: 'test',
    timeoutMs: 2000,
    dispatcher: agent,
  });
  const newsClient = new HikariClient({
    baseUrl: NEWS_FEED,
    userAgent: 'test',
    timeoutMs: 2000,
    dispatcher: agent,
  });
  const hikariAuth = new HikariAuth(client);
  const sessions = new SessionService(
    new MemorySessionStore(),
    new Sealer(testEnv.SESSION_ENCRYPTION_KEY),
    {
      ttlMs: 3_600_000,
      revalidateMs,
      ...(remember && { relogin: (user: string, pass: string) => hikariAuth.login(user, pass) }),
    },
  );
  const userData = new MemoryUserDataStore();
  const alerts = new AlertService(userData, notifier);
  const mvp = new MvpService(client, HIKARI);
  const app = await buildApp({
    env: { ...testEnv, ...env, ...(webDir && { WEB_DIST_DIR: webDir }) },
    hikariAuth,
    sessions,
    loginThrottle: new MemoryLoginThrottle({ maxAttempts: 3, windowMs: 60_000 }),
    mvp,
    news: new NewsService(newsClient, '/discord/feed.php'),
    markets: new MarketService(client, HIKARI),
    wiki: new WikiService(client, HIKARI),
    albums: new AlbumService(client, HIKARI),
    userData,
    alerts,
  });
  return { app, sessions, userData, alerts, mvp, hikariAuth };
}

/** Prepara un login correcto en el mock de HikariRO. */
export function mockSuccessfulLogin(pool: ReturnType<MockAgent['get']>) {
  pool
    .intercept({ path: '/?module=account&action=login', method: 'GET' })
    .reply(200, fixture('login-page.html'), {
      headers: { 'set-cookie': 'fluxSessionData=anon123; path=/; SameSite=Lax' },
    });
  pool
    .intercept({
      path: '/?module=account&action=login&return_url=',
      method: 'POST',
      body: (body) => {
        const form = new URLSearchParams(body);
        return (
          form.get('username') === 'ivan' &&
          form.get('password') === 'correcta' &&
          form.get('server') === 'TestSrv1'
        );
      },
    })
    .reply(302, '', {
      headers: { location: '/?module=main', 'set-cookie': 'fluxSessionData=auth456; path=/' },
    });
  pool
    .intercept({
      path: '/?module=account&action=view',
      method: 'GET',
      headers: { cookie: 'fluxSessionData=auth456' },
    })
    .reply(200, fixture('account-view.html'));
}

export function cookieFrom(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (header ?? '').split(';')[0] ?? '';
}

type Pool = ReturnType<MockAgent['get']>;

/** Inicia sesión contra el mock y devuelve la cookie de Hikari Hub y el token CSRF. */
export async function loginAs(app: FastifyInstance, pool: Pool, { remember = false } = {}) {
  mockSuccessfulLogin(pool);
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: 'ivan', password: 'correcta', remember },
    headers: { origin: APP_ORIGIN },
  });
  return { cookie: cookieFrom(response.headers['set-cookie']), csrf: response.json().csrfToken };
}

/** Prepara en el mock los dos mercados completos a partir de las fixtures. */
export function mockMarkets(pool: Pool, { closedShop = false } = {}) {
  const html = { headers: { 'content-type': 'text/html' } };
  pool
    .intercept({ path: '/?module=vending', method: 'GET' })
    .reply(200, fixture('vending-list.html'), html);
  pool
    .intercept({ path: '/?module=vending&action=viewshop&id=1', method: 'GET' })
    .reply(200, fixture('vending-shop-1.html'), html);
  pool
    .intercept({ path: '/?module=vending&action=viewshop&id=4', method: 'GET' })
    .reply(200, fixture(closedShop ? 'shop-not-found.html' : 'vending-shop-4.html'), html);
  pool
    .intercept({ path: '/?module=buyingstore', method: 'GET' })
    .reply(200, fixture('buying-list.html'), html);
  pool
    .intercept({ path: '/?module=buyingstore&action=viewshop&id=1', method: 'GET' })
    .reply(200, fixture('buying-shop-1.html'), html);
}
