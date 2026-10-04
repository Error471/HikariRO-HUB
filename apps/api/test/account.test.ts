import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MemoryUserDataStore } from '../src/user/user-data-store.js';
import { APP_ORIGIN, createMockHikari, createTestApp, loginAs } from './helpers.js';

describe('DELETE /api/account/data', () => {
  let app: FastifyInstance;
  let agent: MockAgent;
  let pool: ReturnType<MockAgent['get']>;
  let userData: MemoryUserDataStore;

  beforeEach(async () => {
    ({ agent, pool } = createMockHikari());
    ({ app, userData } = await createTestApp(agent));
  });

  afterEach(async () => {
    await app.close();
    await agent.close();
  });

  const remove = (headers: Record<string, string>) =>
    app.inject({
      method: 'DELETE',
      url: '/api/account/data',
      headers: { origin: APP_ORIGIN, ...headers },
    });

  it('exige sesión y token CSRF', async () => {
    expect((await remove({})).statusCode).toBe(401);
    const { cookie } = await loginAs(app, pool);
    expect((await remove({ cookie })).statusCode).toBe(403);
  });

  it('borra favoritos, avisos y la sesión', async () => {
    const { cookie, csrf } = await loginAs(app, pool);
    await userData.setFavorites('ivan', [1039]);
    await userData.setAlerts('ivan', { enabled: true, leadMinutes: 10, watchSessionId: 'x' });

    pool
      .intercept({ path: '/?module=account&action=logout', method: 'GET' })
      .reply(302, '', { headers: { location: '/' } });
    const response = await remove({ cookie, 'x-csrf-token': csrf });

    expect(response.statusCode).toBe(204);
    expect(String(response.headers['set-cookie'])).toMatch(/__Host-hh_sid=;/);
    expect(await userData.getFavorites('ivan')).toEqual([]);
    expect(await userData.getAlerts('ivan')).toMatchObject({
      enabled: false,
      watchSessionId: null,
    });
    expect(await userData.alertUsers()).toEqual([]);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it('borra los datos aunque HikariRO no responda al cerrar sesión', async () => {
    const { cookie, csrf } = await loginAs(app, pool);
    await userData.setFavorites('ivan', [1039]);
    pool.intercept({ path: '/?module=account&action=logout', method: 'GET' }).reply(503, '');

    const response = await remove({ cookie, 'x-csrf-token': csrf });
    expect(response.statusCode).toBe(204);
    expect(await userData.getFavorites('ivan')).toEqual([]);
  });
});

describe('GET /api/info', () => {
  it('es público y no expone configuración interna', async () => {
    const { agent } = createMockHikari();
    const { app } = await createTestApp(agent);
    const response = await app.inject({ method: 'GET', url: '/api/info' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ privacyContact: null, rememberAvailable: false });
    await app.close();
    await agent.close();
  });
});
