import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UpstreamMonitor } from '../src/hikari/upstream-monitor.js';
import { AppError } from '../src/lib/app-error.js';
import { describeLogCall, ErrorJournal, sanitizeLogText } from '../src/lib/error-journal.js';
import { parseFishingAlbum } from '../src/modules/albums/album-parser.js';
import { parseShopDetail, parseShopList } from '../src/modules/markets/market-parser.js';
import { createMockHikari, createTestApp, HIKARI, loginAs } from './helpers.js';

describe('UpstreamMonitor', () => {
  const clock = () => new Date('2026-10-05T10:00:00Z');

  it('empieza sin datos y registra éxitos y cambios de formato', async () => {
    const monitor = new UpstreamMonitor(clock);
    expect(monitor.snapshot().every((entry) => entry.state === 'unknown')).toBe(true);

    await monitor.track('mvp', async () => 1);
    await expect(
      monitor.track('news', () => Promise.reject(new AppError('UPSTREAM_CHANGED'))),
    ).rejects.toThrow();
    await expect(
      monitor.track('wiki', () => Promise.reject(new AppError('UPSTREAM_UNAVAILABLE'))),
    ).rejects.toThrow();

    const states = Object.fromEntries(monitor.snapshot().map((m) => [m.module, m.state]));
    expect(states).toMatchObject({ mvp: 'ok', news: 'changed', wiki: 'unavailable' });
  });

  it('no cambia el estado por errores que no son de HikariRO', async () => {
    const monitor = new UpstreamMonitor(clock);
    await monitor.track('cards', async () => 1);
    await expect(
      monitor.track('cards', () => Promise.reject(new AppError('SESSION_EXPIRED'))),
    ).rejects.toThrow();
    expect(monitor.snapshot().find((m) => m.module === 'cards')?.state).toBe('ok');
  });

  it('avisa solo en las transiciones', async () => {
    const monitor = new UpstreamMonitor(clock);
    const changes: string[] = [];
    monitor.onChange((module, state) => changes.push(`${module}:${state}`));
    const fail = () => Promise.reject(new AppError('UPSTREAM_CHANGED'));

    await monitor.track('markets', fail).catch(() => undefined);
    await monitor.track('markets', fail).catch(() => undefined);
    await monitor.track('markets', async () => 1);
    expect(changes).toEqual(['markets:changed', 'markets:ok']);
  });
});

describe('ErrorJournal', () => {
  it('guarda los últimos mensajes, del más nuevo al más antiguo', () => {
    const journal = new ErrorJournal(2);
    journal.add('warn', 'uno');
    journal.add('error', 'dos');
    journal.add('warn', 'tres');
    expect(journal.list().map((entry) => entry.message)).toEqual(['tres', 'dos']);
  });

  it('no guarda tokens, contraseñas ni rutas de usuario', () => {
    const text = sanitizeLogText(
      'POST https://api.telegram.org/bot123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw/sendMessage password=hunter2 C:\\Users\\Ivan\\AppData',
    );
    expect(text).not.toContain('AAHdqTcv');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('Ivan');
  });

  it('resume las llamadas al logger', () => {
    expect(
      describeLogCall([{ code: 'UPSTREAM_CHANGED', cause: 'ZodError' }, 'upstream error']),
    ).toBe('upstream error · UPSTREAM_CHANGED · ZodError');
    expect(describeLogCall([{ err: new TypeError('fallo') }, 'unhandled error'])).toBe(
      'unhandled error · TypeError: fallo',
    );
  });
});

describe('detección de cambios en el HTML', () => {
  it('falla si hay tiendas pero ninguna se reconoce', () => {
    const html = '<div class="hro-shops"><div class="hro-shop-card"><h4>Tienda</h4></div></div>';
    expect(() => parseShopList(html, 'vending', HIKARI)).toThrow(AppError);
    expect(parseShopList('<div class="hro-shops"></div>', 'vending', HIKARI)).toEqual([]);
  });

  it('falla si una tienda tiene objetos pero ninguno se reconoce', () => {
    const html = '<div class="hro-shop-detail"><div class="hro-market-item"><p>?</p></div></div>';
    expect(() => parseShopDetail(html, HIKARI)).toThrow(AppError);
  });

  it('falla si el álbum de pesca no tiene especies', () => {
    expect(() => parseFishingAlbum('<div class="fish-album"></div>', HIKARI)).toThrow(AppError);
  });
});

describe('GET /api/diagnostics', () => {
  let app: FastifyInstance;
  let agent: MockAgent;
  let pool: ReturnType<MockAgent['get']>;
  let journal: ErrorJournal;

  beforeEach(async () => {
    ({ agent, pool } = createMockHikari());
    ({ app, journal } = await createTestApp(agent));
  });

  afterEach(async () => {
    await app.close();
    await agent.close();
  });

  it('exige sesión', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/diagnostics' });
    expect(response.statusCode).toBe(401);
  });

  it('muestra el estado de cada módulo y los errores recientes', async () => {
    const { cookie, csrf } = await loginAs(app, pool);
    pool
      .intercept({ path: '/?module=mvptimer&ajax=1', method: 'GET' })
      .reply(200, '<html>nuevo diseño</html>', { headers: { 'content-type': 'text/html' } });
    const mvp = await app.inject({ method: 'GET', url: '/api/mvp', headers: { cookie } });
    expect(mvp.json().error.code).toBe('UPSTREAM_CHANGED');
    journal.add('warn', 'aviso de prueba');

    const response = await app.inject({
      method: 'GET',
      url: '/api/diagnostics',
      headers: { cookie },
    });
    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.version).toBe('dev');
    const states = Object.fromEntries(
      body.modules.map((m: { module: string; state: string }) => [m.module, m.state]),
    );
    expect(states).toMatchObject({ login: 'ok', mvp: 'changed', news: 'unknown' });
    expect(body.entries[0].message).toBe('aviso de prueba');

    const cleared = await app.inject({
      method: 'DELETE',
      url: '/api/diagnostics/entries',
      headers: { cookie, 'x-csrf-token': csrf, origin: 'https://hub.test' },
    });
    expect(cleared.statusCode).toBe(204);
    expect(journal.list()).toEqual([]);
  });
});
