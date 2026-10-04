import type { AlertMessage, MvpListResponse } from '@hikari-hub/shared';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AlertService } from '../src/modules/alerts/alerts.service.js';
import { dueAlerts } from '../src/modules/alerts/mvp-alerts.js';
import { MvpWatcher } from '../src/modules/alerts/mvp-watcher.js';
import type { Notifier } from '../src/modules/alerts/notifier.js';
import type { MvpService } from '../src/modules/mvp/mvp.service.js';
import type { SessionService } from '../src/session/session-service.js';
import { FileSessionStore } from '../src/session/session-store.js';
import { FileUserDataStore, type MemoryUserDataStore } from '../src/user/user-data-store.js';
import { APP_ORIGIN, createMockHikari, createTestApp, loginAs } from './helpers.js';

class FakeNotifier implements Notifier {
  readonly shown: AlertMessage[] = [];

  async notify(message: AlertMessage): Promise<boolean> {
    this.shown.push(message);
    return true;
  }
}

describe('dueAlerts', () => {
  const data: MvpListResponse = {
    serverNow: 10_000,
    mvps: [
      {
        id: 1,
        name: 'Baphomet',
        imageUrl: '',
        detailUrl: '',
        spawns: [
          { map: 'prt_maze03', killedAt: 1, minAt: 10_300, maxAt: 10_900 },
          { map: 'prt_maze02', killedAt: 1, minAt: 9_960, maxAt: 10_600 },
        ],
      },
      {
        id: 2,
        name: 'Drake',
        imageUrl: '',
        detailUrl: '',
        spawns: [{ map: 'treasure02', killedAt: 1, minAt: 9_990, maxAt: 10_500 }],
      },
    ],
  };

  it('avisa con antelación y al abrirse la ventana, solo de favoritos', () => {
    const alerts = dueAlerts({ data, favorites: new Set([1]), leadMinutes: 5, graceSeconds: 180 });
    expect(alerts.map((alert) => alert.key)).toEqual([
      '1:prt_maze03:10300:lead',
      '1:prt_maze02:9960:window',
    ]);
    expect(alerts[0]?.message).toMatchObject({
      title: 'Baphomet sale pronto',
      body: 'Puede aparecer en 5 minutos en prt_maze03.',
      url: '/mvp?filter=favorites',
    });
    expect(alerts[1]?.message.body).toBe(
      'Ventana de respawn abierta en prt_maze02 durante 10 minutos.',
    );
  });

  it('sin antelación solo avisa al abrirse la ventana', () => {
    const alerts = dueAlerts({
      data,
      favorites: new Set([1, 2]),
      leadMinutes: 0,
      graceSeconds: 180,
    });
    expect(alerts.map((alert) => alert.key)).toEqual([
      '1:prt_maze02:9960:window',
      '2:treasure02:9990:window',
    ]);
  });

  it('no avisa de ventanas antiguas', () => {
    const alerts = dueAlerts({ data, favorites: new Set([1]), leadMinutes: 0, graceSeconds: 30 });
    expect(alerts).toEqual([]);
  });
});

describe('rutas de favoritos y avisos', () => {
  let app: FastifyInstance;
  let agent: MockAgent;
  let pool: ReturnType<MockAgent['get']>;
  let notifier: FakeNotifier;
  let userData: MemoryUserDataStore;
  let sessions: SessionService;
  let alerts: AlertService;
  let mvp: MvpService;

  beforeEach(async () => {
    ({ agent, pool } = createMockHikari());
    notifier = new FakeNotifier();
    ({ app, userData, sessions, alerts, mvp } = await createTestApp(agent, { notifier }));
  });

  afterEach(async () => {
    await app.close();
    await agent.close();
  });

  const send = (
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    url: string,
    auth: { cookie: string; csrf?: string },
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      payload: payload as object,
      headers: {
        cookie: auth.cookie,
        origin: APP_ORIGIN,
        ...(auth.csrf && { 'x-csrf-token': auth.csrf }),
      },
    });

  it('guarda los favoritos por cuenta, sin duplicados y con CSRF', async () => {
    const auth = await loginAs(app, pool);
    expect((await send('GET', '/api/mvp/favorites', auth)).json()).toEqual({ ids: [] });

    const noCsrf = await send('PUT', '/api/mvp/favorites', { cookie: auth.cookie }, { ids: [1] });
    expect(noCsrf.statusCode).toBe(403);

    const saved = await send('PUT', '/api/mvp/favorites', auth, { ids: [1511, 30027, 1511] });
    expect(saved.json()).toEqual({ ids: [1511, 30027] });
    expect(await userData.getFavorites('IVAN')).toEqual([1511, 30027]);

    const invalid = await send('PUT', '/api/mvp/favorites', auth, { ids: ['x'] });
    expect(invalid.statusCode).toBe(422);
  });

  it('activa los avisos, cambia la antelación y envía una prueba', async () => {
    const auth = await loginAs(app, pool);
    const config = await send('GET', '/api/alerts/config', auth);
    expect(config.json()).toEqual({
      available: true,
      enabled: false,
      leadMinutes: 5,
      watching: false,
    });

    const enabled = await send('PUT', '/api/alerts/settings', auth, { enabled: true });
    expect(enabled.json()).toMatchObject({ enabled: true, watching: true });

    const settings = await send('PUT', '/api/alerts/settings', auth, { leadMinutes: 15 });
    expect(settings.json()).toMatchObject({ enabled: true, leadMinutes: 15 });
    expect((await send('PUT', '/api/alerts/settings', auth, { leadMinutes: 7 })).statusCode).toBe(
      422,
    );
    expect((await send('PUT', '/api/alerts/settings', auth, {})).statusCode).toBe(422);

    expect((await send('POST', '/api/alerts/test', auth)).json()).toEqual({ sent: true });
    expect(notifier.shown[0]?.title).toBe('Avisos activados');

    const disabled = await send('PUT', '/api/alerts/settings', auth, { enabled: false });
    expect(disabled.json()).toMatchObject({ enabled: false, watching: false });
    expect(await userData.alertUsers()).toEqual([]);
  });

  it('al cerrar sesión deja de vigilar y al volver a entrar se reactiva', async () => {
    const auth = await loginAs(app, pool);
    await send('PUT', '/api/alerts/settings', auth, { enabled: true });

    pool
      .intercept({ path: '/?module=account&action=logout', method: 'GET' })
      .reply(302, '', { headers: { location: '/' } });
    await send('POST', '/api/auth/logout', auth);
    expect((await userData.getAlerts('ivan')).watchSessionId).toBeNull();

    await loginAs(app, pool);
    expect((await userData.getAlerts('ivan')).watchSessionId).not.toBeNull();
  });

  it('el vigilante envía cada aviso una sola vez y avisa si la sesión caduca', async () => {
    const auth = await loginAs(app, pool);
    await send('PUT', '/api/mvp/favorites', auth, { ids: [1] });
    await send('PUT', '/api/alerts/settings', auth, { enabled: true });

    const now = 1_800_000_000;
    pool
      .intercept({ path: '/?module=mvptimer&ajax=1', method: 'GET' })
      .reply(
        200,
        JSON.stringify({
          ok: true,
          server_now: now,
          rows: [
            {
              id: 1,
              name: 'Baphomet',
              map: 'prt_maze03',
              killed_at: 1,
              min_at: now - 20,
              max_at: now + 600,
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      )
      .times(2);

    const watcher = new MvpWatcher({
      store: userData,
      sessions,
      mvp,
      alerts,
      intervalMs: 60_000,
      logger: app.log,
    });
    expect(await watcher.checkUser('ivan')).toBe(1);
    expect(notifier.shown[0]?.title).toBe('Baphomet puede aparecer ya');
    expect(await watcher.checkUser('ivan')).toBe(0);

    const { watchSessionId } = await userData.getAlerts('ivan');
    await sessions.destroy(watchSessionId ?? '');
    await watcher.checkUser('ivan');
    expect(notifier.shown.at(-1)?.title).toBe('Avisos de MVP en pausa');
    expect((await userData.getAlerts('ivan')).watchSessionId).toBeNull();
  });
});

describe('avisos fuera de la app de escritorio', () => {
  it('informa de que no están disponibles', async () => {
    const { agent, pool } = createMockHikari();
    const { app } = await createTestApp(agent);
    const auth = await loginAs(app, pool);
    const headers = { cookie: auth.cookie, origin: APP_ORIGIN, 'x-csrf-token': auth.csrf };
    const config = await app.inject({ method: 'GET', url: '/api/alerts/config', headers });
    expect(config.json()).toMatchObject({ available: false, enabled: false });
    const enable = await app.inject({
      method: 'PUT',
      url: '/api/alerts/settings',
      headers,
      payload: { enabled: true },
    });
    expect(enable.statusCode).toBe(404);
    await app.close();
    await agent.close();
  });
});

describe('almacenes en archivo', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hikari-hub-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('conserva favoritos y avisos al reiniciar', async () => {
    const path = join(dir, 'user-data.json');
    const first = new FileUserDataStore(path);
    await first.setFavorites('Ivan', [1039, 1511]);
    await first.setAlerts('ivan', { enabled: true, leadMinutes: 10, watchSessionId: 's1' });
    expect(await first.claimNotification('k', 60)).toBe(true);

    const second = new FileUserDataStore(path);
    expect(await second.getFavorites('IVAN')).toEqual([1039, 1511]);
    expect(await second.alertUsers()).toEqual(['ivan']);
    expect(await second.claimNotification('k', 60)).toBe(false);

    await second.deleteUser('ivan');
    expect(await new FileUserDataStore(path).getFavorites('ivan')).toEqual([]);
  });

  it('conserva las sesiones vigentes y descarta las caducadas', async () => {
    const path = join(dir, 'sessions.json');
    const store = new FileSessionStore(path);
    const record = {
      username: 'ivan',
      upstream: 'cifrado',
      csrfToken: 't',
      createdAt: 1,
      validatedAt: 1,
    };
    await store.set('vigente', { ...record, expiresAt: Date.now() + 60_000 });
    await store.set('caducada', { ...record, expiresAt: Date.now() - 1 });

    const reloaded = new FileSessionStore(path);
    expect(await reloaded.get('vigente')).toMatchObject({ username: 'ivan' });
    expect(await reloaded.get('caducada')).toBeNull();
  });

  it('ignora un archivo dañado', async () => {
    const path = join(dir, 'user-data.json');
    const store = new FileUserDataStore(path);
    await store.setFavorites('ivan', [1]);
    expect(JSON.parse(readFileSync(path, 'utf8')).favorites).toEqual({ ivan: [1] });
    writeFileSync(path, '{roto');
    expect(await new FileUserDataStore(path).getFavorites('ivan')).toEqual([]);
  });
});
