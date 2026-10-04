import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockHikari, createTestApp, fixture, loginAs } from './helpers.js';

let app: FastifyInstance;
let agent: MockAgent;
let pool: ReturnType<MockAgent['get']>;
let newsPool: ReturnType<MockAgent['get']>;

beforeEach(async () => {
  ({ agent, pool, newsPool } = createMockHikari());
  ({ app } = await createTestApp(agent));
});

afterEach(async () => {
  await app.close();
  await agent.close();
});

const mockMvp = (status: number, body: string, headers: Record<string, string>) =>
  pool
    .intercept({
      path: '/?module=mvptimer&ajax=1',
      method: 'GET',
      headers: { cookie: 'fluxSessionData=auth456' },
    })
    .reply(status, body, { headers });

describe('GET /api/mvp', () => {
  it('exige sesión', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/mvp' });
    expect(response.statusCode).toBe(401);
  });

  it('agrupa los spawns por MVP y usa la sesión del usuario en HikariRO', async () => {
    const { cookie } = await loginAs(app, pool);
    mockMvp(200, fixture('mvp-timer.json'), { 'content-type': 'application/json; charset=utf-8' });

    const response = await app.inject({ method: 'GET', url: '/api/mvp', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Math.floor(body.serverNow)).toBe(1791040608);
    expect(body.mvps).toHaveLength(2);
    expect(body.mvps[1]).toMatchObject({
      id: 30027,
      name: 'Arachne',
      imageUrl: 'https://hikariro.test/data/monsters/30027.gif',
      spawns: [
        { map: 'cavemine01', killedAt: 1791038766, minAt: 1791045966, maxAt: 1791047766 },
        { map: 'cavemine02', killedAt: null, minAt: null, maxAt: null },
      ],
    });

    // Segunda llamada servida desde la cache (el mock solo responde una vez).
    const cached = await app.inject({ method: 'GET', url: '/api/mvp', headers: { cookie } });
    expect(cached.statusCode).toBe(200);
  });

  it('cierra la sesión de Hikari Hub si HikariRO redirige al login', async () => {
    const { cookie } = await loginAs(app, pool);
    mockMvp(302, '', { location: '/?module=account&action=login&return_url=%2F' });

    const response = await app.inject({ method: 'GET', url: '/api/mvp', headers: { cookie } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('SESSION_EXPIRED');
    expect(String(response.headers['set-cookie'])).toMatch(/__Host-hh_sid=;/);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.json().error.code).toBe('SESSION_EXPIRED');
  });

  it('detecta cambios de formato en HikariRO', async () => {
    const { cookie } = await loginAs(app, pool);
    mockMvp(200, '{"rows":"x"}', { 'content-type': 'application/json' });

    const response = await app.inject({ method: 'GET', url: '/api/mvp', headers: { cookie } });
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('UPSTREAM_CHANGED');
  });
});

describe('GET /api/news', () => {
  it('normaliza el feed y filtra URLs no permitidas', async () => {
    const { cookie } = await loginAs(app, pool);
    newsPool
      .intercept({ path: '/discord/feed.php', method: 'GET' })
      .reply(200, fixture('news-feed.json'), { headers: { 'content-type': 'application/json' } });

    const response = await app.inject({ method: 'GET', url: '/api/news', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    const { posts, updatedAt } = response.json();
    expect(updatedAt).toBe('2026-10-03T15:58:10+00:00');
    expect(posts[0]).toMatchObject({
      id: '100',
      section: 'noticias',
      title: '📱 ¡Nuevo evento de prueba! 🎉',
      imageUrl: 'https://cdn.discordapp.com/attachments/1/2/evento.png',
      sourceUrl: 'https://discord.com/channels/1/2/100',
    });
    expect(posts[0].summary).toContain('Participa en el evento');
    expect(posts[1]).toMatchObject({ title: '⚔️ Cambios de equilibrio', imageUrl: null });
    expect(posts[2]).toMatchObject({
      section: 'otros',
      author: 'Equipo HikariRO',
      title: 'Publicación de Equipo HikariRO',
      imageUrl: null,
      sourceUrl: null,
    });
  });

  it('informa si el feed no está disponible', async () => {
    const { cookie } = await loginAs(app, pool);
    newsPool.intercept({ path: '/discord/feed.php', method: 'GET' }).reply(503, 'down');

    const response = await app.inject({ method: 'GET', url: '/api/news', headers: { cookie } });
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
