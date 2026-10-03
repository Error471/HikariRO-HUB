import type { MvpListResponse, PushMessage, PushSubscriptionJson } from '@hrc/shared';
import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dueAlerts } from '../src/modules/push/mvp-alerts.js';
import { MvpWatcher } from '../src/modules/push/mvp-watcher.js';
import type { PushService } from '../src/modules/push/push.service.js';
import {
  isAllowedPushEndpoint,
  type PushResult,
  type PushSender,
} from '../src/modules/push/push-sender.js';
import type { MvpService } from '../src/modules/mvp/mvp.service.js';
import type { SessionService } from '../src/session/session-service.js';
import type { MemoryUserDataStore } from '../src/user/user-data-store.js';
import { APP_ORIGIN, createMockHikari, createTestApp, loginAs } from './helpers.js';

class FakeSender implements PushSender {
  readonly publicKey = 'BPublicKeyDePrueba';
  readonly sent: { endpoint: string; message: PushMessage }[] = [];
  readonly results = new Map<string, PushResult>();

  async send(subscription: PushSubscriptionJson, message: PushMessage): Promise<PushResult> {
    const result = this.results.get(subscription.endpoint) ?? 'sent';
    if (result === 'sent') this.sent.push({ endpoint: subscription.endpoint, message });
    return result;
  }
}

const subscription = (id: string): PushSubscriptionJson => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  expirationTime: null,
  keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
});

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

describe('isAllowedPushEndpoint', () => {
  it('solo acepta servicios de push conocidos por HTTPS', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(
      true,
    );
    expect(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://169.254.169.254/latest')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.test/x')).toBe(false);
  });
});

describe('rutas de favoritos y avisos', () => {
  let app: FastifyInstance;
  let agent: MockAgent;
  let pool: ReturnType<MockAgent['get']>;
  let sender: FakeSender;
  let userData: MemoryUserDataStore;
  let sessions: SessionService;
  let push: PushService;
  let mvp: MvpService;

  beforeEach(async () => {
    ({ agent, pool } = createMockHikari());
    sender = new FakeSender();
    ({ app, userData, sessions, push, mvp } = await createTestApp(agent, { pushSender: sender }));
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

  it('suscribe, envía una prueba y olvida dispositivos anulados', async () => {
    const auth = await loginAs(app, pool);
    const config = await send('GET', '/api/push/config', auth);
    expect(config.json()).toMatchObject({
      enabled: true,
      publicKey: 'BPublicKeyDePrueba',
      leadMinutes: 5,
    });

    const rejected = await send('POST', '/api/push/subscriptions', auth, {
      ...subscription('a'),
      endpoint: 'https://intranet.example/hook',
    });
    expect(rejected.statusCode).toBe(422);

    await send('POST', '/api/push/subscriptions', auth, subscription('a'));
    const second = await send('POST', '/api/push/subscriptions', auth, subscription('b'));
    expect(second.json()).toMatchObject({ watching: true });
    expect(second.json().endpoints).toHaveLength(2);

    sender.results.set(subscription('b').endpoint, 'gone');
    const test = await send('POST', '/api/push/test', auth);
    expect(test.json()).toEqual({ sent: 1 });
    expect((await userData.getPush('ivan')).subscriptions).toHaveLength(1);

    const settings = await send('PUT', '/api/push/settings', auth, { leadMinutes: 15 });
    expect(settings.json().leadMinutes).toBe(15);
    const badSettings = await send('PUT', '/api/push/settings', auth, { leadMinutes: 7 });
    expect(badSettings.statusCode).toBe(422);

    const removed = await send('DELETE', '/api/push/subscriptions', auth, {
      endpoint: subscription('a').endpoint,
    });
    expect(removed.json()).toMatchObject({ endpoints: [], watching: false });
  });

  it('al cerrar sesión deja de vigilar y al volver a entrar se reactiva', async () => {
    const auth = await loginAs(app, pool);
    await send('POST', '/api/push/subscriptions', auth, subscription('a'));

    pool
      .intercept({ path: '/?module=account&action=logout', method: 'GET' })
      .reply(302, '', { headers: { location: '/' } });
    await send('POST', '/api/auth/logout', auth);
    expect((await userData.getPush('ivan')).watchSessionId).toBeNull();

    await loginAs(app, pool);
    expect((await userData.getPush('ivan')).watchSessionId).not.toBeNull();
  });

  it('el vigilante envía cada aviso una sola vez y avisa si la sesión caduca', async () => {
    const auth = await loginAs(app, pool);
    await send('PUT', '/api/mvp/favorites', auth, { ids: [1] });
    await send('POST', '/api/push/subscriptions', auth, subscription('a'));

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
      push,
      intervalMs: 60_000,
      logger: app.log,
    });
    expect(await watcher.checkUser('ivan')).toBe(1);
    expect(sender.sent[0]?.message.title).toBe('Baphomet puede aparecer ya');
    expect(await watcher.checkUser('ivan')).toBe(0);

    const { watchSessionId } = await userData.getPush('ivan');
    await sessions.destroy(watchSessionId ?? '');
    await watcher.checkUser('ivan');
    expect(sender.sent.at(-1)?.message.title).toBe('Avisos de MVP en pausa');
    expect((await userData.getPush('ivan')).watchSessionId).toBeNull();
  });
});

describe('avisos sin claves VAPID', () => {
  it('informa de que no están disponibles', async () => {
    const { agent, pool } = createMockHikari();
    const { app } = await createTestApp(agent);
    const auth = await loginAs(app, pool);
    const headers = { cookie: auth.cookie, origin: APP_ORIGIN, 'x-csrf-token': auth.csrf };
    const config = await app.inject({ method: 'GET', url: '/api/push/config', headers });
    expect(config.json()).toMatchObject({ enabled: false, publicKey: null });
    const subscribe = await app.inject({
      method: 'POST',
      url: '/api/push/subscriptions',
      headers,
      payload: subscription('a'),
    });
    expect(subscribe.statusCode).toBe(404);
    await app.close();
    await agent.close();
  });
});
