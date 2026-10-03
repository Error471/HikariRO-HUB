import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import {
  APP_ORIGIN,
  cookieFrom,
  createMockHikari,
  createTestApp,
  fixture,
  mockSuccessfulLogin,
} from './helpers.js';

let app: FastifyInstance;
let agent: MockAgent;
let pool: ReturnType<MockAgent['get']>;
let sessions: Awaited<ReturnType<typeof createTestApp>>['sessions'];

const login = (body: unknown, headers: Record<string, string> = { origin: APP_ORIGIN }) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: body as object, headers });

async function loginOk() {
  mockSuccessfulLogin(pool);
  const response = await login({ username: 'ivan', password: 'correcta' });
  expect(response.statusCode).toBe(200);
  return { cookie: cookieFrom(response.headers['set-cookie']), body: response.json() };
}

beforeEach(async () => {
  ({ agent, pool } = createMockHikari());
  ({ app, sessions } = await createTestApp(agent));
});

afterEach(async () => {
  await app.close();
  await agent.close();
});

describe('POST /api/auth/login', () => {
  it('inicia sesión en HikariRO y emite una cookie segura y opaca', async () => {
    mockSuccessfulLogin(pool);
    const response = await login({ username: 'ivan', password: 'correcta' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toEqual({ username: 'ivan' });
    expect(body.csrfToken).toEqual(expect.any(String));

    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toMatch(/^__Host-hrc_sid=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).not.toContain('auth456');
    expect(response.body).not.toContain('auth456');
    expect(response.body).not.toContain('correcta');
  });

  it('responde INVALID_CREDENTIALS cuando HikariRO no autentica', async () => {
    pool
      .intercept({ path: '/?module=account&action=login', method: 'GET' })
      .reply(200, fixture('login-page.html'));
    pool
      .intercept({ path: '/?module=account&action=login&return_url=', method: 'POST' })
      .reply(200, fixture('login-page.html'));
    pool
      .intercept({ path: '/?module=account&action=view', method: 'GET' })
      .reply(302, '', { headers: { location: '/?module=account&action=login&return_url=x' } });

    const response = await login({ username: 'ivan', password: 'mal' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('bloquea el usuario tras varios intentos fallidos sin contactar con HikariRO', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      pool
        .intercept({ path: '/?module=account&action=login', method: 'GET' })
        .reply(200, fixture('login-page.html'));
      pool
        .intercept({ path: '/?module=account&action=login&return_url=', method: 'POST' })
        .reply(200, fixture('login-page.html'));
      pool
        .intercept({ path: '/?module=account&action=view', method: 'GET' })
        .reply(302, '', { headers: { location: '/?module=account&action=login' } });
      await login({ username: 'Ivan', password: 'mal' });
    }
    const blocked = await login({ username: 'ivan', password: 'correcta' });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
  });

  it('rechaza peticiones sin el Origin de la app (CSRF)', async () => {
    const response = await login(
      { username: 'ivan', password: 'x' },
      { origin: 'https://evil.test' },
    );
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CSRF_INVALID');
  });

  it('valida la entrada', async () => {
    const response = await login({ username: '', password: '' });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('informa de forma comprensible si Cloudflare bloquea la conexión', async () => {
    pool
      .intercept({ path: '/?module=account&action=login', method: 'GET' })
      .reply(403, '<html>Just a moment...</html>', { headers: { 'cf-mitigated': 'challenge' } });
    const response = await login({ username: 'ivan', password: 'x' });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('UPSTREAM_BLOCKED');
  });

  it('informa si HikariRO no responde', async () => {
    pool
      .intercept({ path: '/?module=account&action=login', method: 'GET' })
      .replyWithError(new Error('ECONNREFUSED'));
    const response = await login({ username: 'ivan', password: 'x' });
    expect(response.statusCode).toBe(502);
    expect(response.json().error).toEqual({
      code: 'UPSTREAM_UNAVAILABLE',
      message: expect.stringContaining('No se ha podido conectar con HikariRO'),
    });
    expect(response.body).not.toContain('ECONNREFUSED');
  });
});

describe('GET /api/auth/me', () => {
  it('exige sesión', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('devuelve el usuario con una sesión válida', async () => {
    const { cookie } = await loginOk();
    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.username).toBe('ivan');
  });

  it('detecta que la sesión de HikariRO ha caducado y la elimina', async () => {
    const { cookie } = await loginOk();
    const sessionId = [...(await listSessionIds())][0];
    expect(sessionId).toBeDefined();
    await forceRevalidation();

    pool
      .intercept({ path: '/?module=account&action=view', method: 'GET' })
      .reply(302, '', { headers: { location: '/?module=account&action=login&return_url=y' } });

    const expired = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(expired.statusCode).toBe(401);
    expect(expired.json().error.code).toBe('SESSION_EXPIRED');
    expect(String(expired.headers['set-cookie'])).toMatch(/__Host-hrc_sid=;/);

    const again = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(again.json().error.code).toBe('SESSION_EXPIRED');
  });

  it('ignora cookies con firma manipulada', async () => {
    const { cookie } = await loginOk();
    const tampered = cookie.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: tampered },
    });
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/auth/logout', () => {
  it('exige el token CSRF', async () => {
    const { cookie } = await loginOk();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, origin: APP_ORIGIN },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CSRF_INVALID');
  });

  it('cierra la sesión en HikariRO y en la app', async () => {
    const { cookie, body } = await loginOk();
    pool
      .intercept({ path: '/?module=account&action=logout', method: 'GET' })
      .reply(302, '', { headers: { location: '/?module=main' } });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, origin: APP_ORIGIN, 'x-csrf-token': body.csrfToken },
    });
    expect(response.statusCode).toBe(204);
    expect(String(response.headers['set-cookie'])).toMatch(/__Host-hrc_sid=;/);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });
});

describe('cabeceras de seguridad', () => {
  it('se aplican a todas las respuestas', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

async function listSessionIds(): Promise<Set<string>> {
  const store = (sessions as unknown as { store: { records: Map<string, unknown> } }).store;
  return new Set(store.records.keys());
}

async function forceRevalidation() {
  const store = (
    sessions as unknown as {
      store: { records: Map<string, { validatedAt: number }> };
    }
  ).store;
  for (const record of store.records.values()) record.validatedAt = 0;
}
