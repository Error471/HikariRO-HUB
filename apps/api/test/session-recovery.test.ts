import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, describe, expect, it } from 'vitest';
import type { HikariAuth } from '../src/hikari/hikari-auth.js';
import { SessionKeeper } from '../src/session/session-keeper.js';
import type { SessionService } from '../src/session/session-service.js';
import {
  createMockHikari,
  createTestApp,
  fixture,
  loginAs,
  mockSuccessfulLogin,
} from './helpers.js';

type Pool = ReturnType<MockAgent['get']>;

const LOGIN_REDIRECT = { location: '/?module=account&action=login&return_url=%2F' };

let app: FastifyInstance;
let agent: MockAgent;

afterEach(async () => {
  await app.close();
  await agent.close();
});

async function setup(options: { remember?: boolean; revalidateMs?: number } = {}) {
  const mock = createMockHikari();
  agent = mock.agent;
  const created = await createTestApp(agent, options);
  app = created.app;
  return { pool: mock.pool, sessions: created.sessions, hikariAuth: created.hikariAuth };
}

const mockMvp = (pool: Pool, status: number, body: string, headers: Record<string, string>) =>
  pool
    .intercept({ path: '/?module=mvptimer&ajax=1', method: 'GET' })
    .reply(status, body, { headers });

const mockAccountView = (pool: Pool, status: number, body: string, headers = {}) =>
  pool
    .intercept({ path: '/?module=account&action=view', method: 'GET' })
    .reply(status, body, { headers });

const onlySession = async (sessions: SessionService) => {
  const [id] = await sessions.list();
  return id ? sessions.find(id) : null;
};

describe('mantener la sesión iniciada', () => {
  it('solo guarda la contraseña si se pide, y cifrada', async () => {
    const { pool, sessions } = await setup({ remember: true });
    await loginAs(app, pool);
    expect((await onlySession(sessions))?.record.credentials).toBeUndefined();

    await loginAs(app, pool, { remember: true });
    const ids = await sessions.list();
    const remembered = await sessions.find(ids.at(-1) ?? '');
    expect(remembered?.record.credentials).toBeTruthy();
    expect(remembered?.record.credentials).not.toContain('correcta');
  });

  it('fuera de la app de escritorio la ignora', async () => {
    const { pool, sessions } = await setup();
    await loginAs(app, pool, { remember: true });
    expect((await onlySession(sessions))?.record.credentials).toBeUndefined();
    const info = await app.inject({ method: 'GET', url: '/api/info' });
    expect(info.json().rememberAvailable).toBe(false);
  });

  it('vuelve a entrar sola cuando HikariRO cierra la sesión y repite la petición', async () => {
    const { pool } = await setup({ remember: true });
    const { cookie } = await loginAs(app, pool, { remember: true });

    mockMvp(pool, 302, '', LOGIN_REDIRECT);
    mockSuccessfulLogin(pool);
    mockMvp(pool, 200, fixture('mvp-timer.json'), { 'content-type': 'application/json' });

    const response = await app.inject({ method: 'GET', url: '/api/mvp', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.json().mvps.length).toBeGreaterThan(0);
  });

  it('si la contraseña ya no vale, cierra la sesión como antes', async () => {
    const { pool } = await setup({ remember: true });
    const { cookie } = await loginAs(app, pool, { remember: true });

    mockMvp(pool, 302, '', LOGIN_REDIRECT);
    pool
      .intercept({ path: '/?module=account&action=login', method: 'GET' })
      .reply(200, fixture('login-page.html'));
    pool
      .intercept({ path: '/?module=account&action=login&return_url=', method: 'POST' })
      .reply(200, fixture('login-page.html'));
    mockAccountView(pool, 302, '', LOGIN_REDIRECT);

    const response = await app.inject({ method: 'GET', url: '/api/mvp', headers: { cookie } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('SESSION_EXPIRED');
  });
});

describe('revalidación', () => {
  it('una respuesta inesperada de HikariRO no cierra la sesión', async () => {
    const { pool } = await setup({ revalidateMs: 0 });
    const { cookie } = await loginAs(app, pool);
    mockAccountView(pool, 200, '<html><body>Mantenimiento</body></html>');

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
  });

  it('sin contraseña guardada, la sesión caducada en HikariRO se cierra', async () => {
    const { pool } = await setup({ revalidateMs: 0 });
    const { cookie } = await loginAs(app, pool);
    mockAccountView(pool, 302, '', LOGIN_REDIRECT);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json().error.code).toBe('SESSION_EXPIRED');
  });

  it('con contraseña guardada, la recupera al revalidar', async () => {
    const { pool } = await setup({ remember: true, revalidateMs: 0 });
    const { cookie } = await loginAs(app, pool, { remember: true });
    mockAccountView(pool, 302, '', LOGIN_REDIRECT);
    mockSuccessfulLogin(pool);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe('ivan');
  });
});

describe('SessionKeeper', () => {
  const keeperFor = (sessions: SessionService, hikari: HikariAuth) =>
    new SessionKeeper({ sessions, hikari, intervalMs: 600_000, logger: app.log });

  it('visita HikariRO para mantener viva la sesión', async () => {
    const { pool, sessions, hikariAuth } = await setup();
    await loginAs(app, pool);
    const [id] = await sessions.list();
    mockAccountView(pool, 200, fixture('account-view.html'));
    expect(await keeperFor(sessions, hikariAuth).keepAlive(id ?? '')).toBe('ok');
    expect(await sessions.list()).toHaveLength(1);
  });

  it('cierra las sesiones que HikariRO ya dio por terminadas', async () => {
    const { pool, sessions, hikariAuth } = await setup();
    await loginAs(app, pool);
    const [id] = await sessions.list();
    mockAccountView(pool, 302, '', LOGIN_REDIRECT);
    expect(await keeperFor(sessions, hikariAuth).keepAlive(id ?? '')).toBe('gone');
    expect(await sessions.list()).toEqual([]);
  });

  it('no cierra la sesión si HikariRO no responde', async () => {
    const { pool, sessions, hikariAuth } = await setup();
    await loginAs(app, pool);
    mockAccountView(pool, 502, 'Bad gateway');
    await keeperFor(sessions, hikariAuth).tick();
    expect(await sessions.list()).toHaveLength(1);
  });
});
