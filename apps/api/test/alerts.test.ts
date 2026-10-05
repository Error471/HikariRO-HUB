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
import { FileUserDataStore, MemoryUserDataStore } from '../src/user/user-data-store.js';
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
    const alerts = dueAlerts({ data, mvpIds: new Set([1]), leadMinutes: 5, graceSeconds: 180 });
    expect(alerts.map((alert) => alert.key)).toEqual([
      '1:prt_maze03:10300:lead',
      '1:prt_maze02:9960:window',
    ]);
    expect(alerts[0]?.message).toMatchObject({
      title: 'Baphomet sale pronto',
      body: 'Puede aparecer en 5 minutos en prt_maze03.',
      url: '/mvp',
    });
    expect(alerts[1]?.message.body).toBe(
      'Ventana de respawn abierta en prt_maze02 durante 10 minutos.',
    );
  });

  it('sin antelación solo avisa al abrirse la ventana', () => {
    const alerts = dueAlerts({
      data,
      mvpIds: new Set([1, 2]),
      leadMinutes: 0,
      graceSeconds: 180,
    });
    expect(alerts.map((alert) => alert.key)).toEqual([
      '1:prt_maze02:9960:window',
      '2:treasure02:9990:window',
    ]);
  });

  it('no avisa de ventanas antiguas', () => {
    const alerts = dueAlerts({ data, mvpIds: new Set([1]), leadMinutes: 0, graceSeconds: 30 });
    expect(alerts).toEqual([]);
  });
});

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';

describe('rutas de favoritos y avisos', () => {
  let app: FastifyInstance;
  let agent: MockAgent;
  let pool: ReturnType<MockAgent['get']>;
  let telegramPool: ReturnType<MockAgent['get']>;
  let notifier: FakeNotifier;
  let userData: MemoryUserDataStore;
  let sessions: SessionService;
  let alerts: AlertService;
  let mvp: MvpService;
  let telegramSent: { chat_id: string; text: string }[];

  beforeEach(async () => {
    ({ agent, pool, telegramPool } = createMockHikari());
    notifier = new FakeNotifier();
    telegramSent = [];
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

  const telegramReply = (method: string, result: unknown, status = 200) =>
    telegramPool
      .intercept({ path: `/bot${TOKEN}/${method}`, method: 'POST' })
      .reply(status, status === 200 ? { ok: true, result } : { ok: false, error_code: status });

  const mockSendMessage = (times = 1) =>
    telegramPool
      .intercept({ path: `/bot${TOKEN}/sendMessage`, method: 'POST' })
      .reply(200, (options) => {
        telegramSent.push(JSON.parse(String(options.body)));
        return { ok: true, result: { message_id: 1 } };
      })
      .times(times);

  const connectTelegram = async (auth: { cookie: string; csrf?: string }) => {
    telegramReply('getMe', { username: 'hikari_avisos_bot' });
    await send('PUT', '/api/alerts/telegram', auth, { botToken: TOKEN });
    telegramReply('getUpdates', [{ update_id: 1, message: { chat: { id: 555 } } }]);
    mockSendMessage();
    return send('POST', '/api/alerts/telegram/detect', auth);
  };

  const mockMvpTimer = (times: number) => {
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
            {
              id: 2,
              name: 'Drake',
              map: 'treasure02',
              killed_at: 1,
              min_at: now - 10,
              max_at: now + 600,
            },
            {
              id: 3,
              name: 'Orc Hero',
              map: 'gef_fild14',
              killed_at: 1,
              min_at: now - 10,
              max_at: now + 600,
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      )
      .times(times);
  };

  const watcherFor = () =>
    new MvpWatcher({ store: userData, sessions, mvp, alerts, intervalMs: 60_000, logger: app.log });

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

  it('elige el canal de cada MVP, la antelación y la pausa general', async () => {
    const auth = await loginAs(app, pool);
    expect((await send('GET', '/api/alerts/config', auth)).json()).toEqual({
      windowsAvailable: true,
      enabled: true,
      leadMinutes: 5,
      watching: true,
      channels: {},
      telegram: { configured: false, botName: null, chatLinked: false },
    });

    await send('PUT', '/api/alerts/mvps/1', auth, { channel: 'windows' });
    const both = await send('PUT', '/api/alerts/mvps/2', auth, { channel: 'both' });
    expect(both.json()).toMatchObject({
      channels: { '1': 'windows', '2': 'both' },
      watching: true,
    });
    const none = await send('PUT', '/api/alerts/mvps/1', auth, { channel: 'none' });
    expect(none.json().channels).toEqual({ '2': 'both' });
    expect((await send('PUT', '/api/alerts/mvps/1', auth, { channel: 'sms' })).statusCode).toBe(
      422,
    );
    expect(
      (await send('PUT', '/api/alerts/mvps/abc', auth, { channel: 'windows' })).statusCode,
    ).toBe(422);

    const lead = await send('PUT', '/api/alerts/settings', auth, { leadMinutes: 15 });
    expect(lead.json().leadMinutes).toBe(15);
    expect((await send('PUT', '/api/alerts/settings', auth, { leadMinutes: 7 })).statusCode).toBe(
      422,
    );

    const paused = await send('PUT', '/api/alerts/settings', auth, { enabled: false });
    expect(paused.json()).toMatchObject({ enabled: false, watching: false });
    expect(await userData.alertUsers()).toEqual([]);

    // Marcar otro MVP reanuda los avisos.
    const resumed = await send('PUT', '/api/alerts/mvps/3', auth, { channel: 'telegram' });
    expect(resumed.json()).toMatchObject({ enabled: true, watching: true });
  });

  it('conecta un bot de Telegram sin devolver nunca el token', async () => {
    const auth = await loginAs(app, pool);
    const badFormat = await send('PUT', '/api/alerts/telegram', auth, { botToken: 'hola' });
    expect(badFormat.statusCode).toBe(422);

    telegramReply('getMe', null, 401);
    const rejected = await send('PUT', '/api/alerts/telegram', auth, { botToken: TOKEN });
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json().error.message).toContain('@BotFather');

    const linked = await connectTelegram(auth);
    expect(linked.json().telegram).toEqual({
      configured: true,
      botName: '@hikari_avisos_bot',
      chatLinked: true,
    });
    expect(telegramSent[0]).toMatchObject({ chat_id: '555' });
    expect(linked.body).not.toContain(TOKEN);
    const stored = await userData.getAlerts('ivan');
    expect(stored.telegram?.token).not.toContain(TOKEN);

    mockSendMessage();
    expect((await send('POST', '/api/alerts/test', auth, { channel: 'telegram' })).json()).toEqual({
      sent: true,
    });
    expect(telegramSent.at(-1)?.text).toContain('Aviso de prueba');

    const removed = await send('DELETE', '/api/alerts/telegram', auth);
    expect(removed.json().telegram.configured).toBe(false);
  });

  it('detectar el chat sin mensajes explica qué hacer', async () => {
    const auth = await loginAs(app, pool);
    telegramReply('getMe', { username: 'hikari_avisos_bot' });
    await send('PUT', '/api/alerts/telegram', auth, { botToken: TOKEN });
    telegramReply('getUpdates', []);
    const response = await send('POST', '/api/alerts/telegram/detect', auth);
    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toContain('Iniciar');

    mockSendMessage();
    const manual = await send('PUT', '/api/alerts/telegram/chat', auth, { chatId: '-100123' });
    expect(manual.json().telegram.chatLinked).toBe(true);
  });

  it('la prueba de Windows usa la notificación del sistema', async () => {
    const auth = await loginAs(app, pool);
    expect((await send('POST', '/api/alerts/test', auth, { channel: 'windows' })).json()).toEqual({
      sent: true,
    });
    expect(notifier.shown[0]?.title).toBe('Aviso de prueba');
  });

  it('al cerrar sesión deja de vigilar y al volver a entrar se reactiva', async () => {
    const auth = await loginAs(app, pool);
    await send('PUT', '/api/alerts/mvps/1', auth, { channel: 'windows' });

    pool
      .intercept({ path: '/?module=account&action=logout', method: 'GET' })
      .reply(302, '', { headers: { location: '/' } });
    await send('POST', '/api/auth/logout', auth);
    expect((await userData.getAlerts('ivan')).watchSessionId).toBeNull();

    await loginAs(app, pool);
    expect((await userData.getAlerts('ivan')).watchSessionId).not.toBeNull();
  });

  it('el vigilante avisa por el canal de cada MVP una sola vez', async () => {
    const auth = await loginAs(app, pool);
    await connectTelegram(auth);
    telegramSent = [];
    await send('PUT', '/api/alerts/mvps/1', auth, { channel: 'windows' });
    await send('PUT', '/api/alerts/mvps/2', auth, { channel: 'telegram' });
    await send('PUT', '/api/alerts/mvps/3', auth, { channel: 'both' });

    mockMvpTimer(2);
    mockSendMessage(2);
    const watcher = watcherFor();
    // Baphomet (Windows) + Drake (Telegram) + Orc Hero (ambos) = 4 entregas.
    expect(await watcher.checkUser('ivan')).toBe(4);
    expect(notifier.shown.map((message) => message.title)).toEqual([
      'Baphomet puede aparecer ya',
      'Orc Hero puede aparecer ya',
    ]);
    expect(telegramSent.map((message) => message.text.split('\n')[0])).toEqual([
      '🔔 Drake puede aparecer ya',
      '🔔 Orc Hero puede aparecer ya',
    ]);
    expect(await watcher.checkUser('ivan')).toBe(0);
  });

  it('si la sesión caduca avisa de la pausa por los canales en uso', async () => {
    const auth = await loginAs(app, pool);
    await send('PUT', '/api/alerts/mvps/1', auth, { channel: 'windows' });
    const { watchSessionId } = await userData.getAlerts('ivan');
    await sessions.destroy(watchSessionId ?? '');

    await watcherFor().checkUser('ivan');
    expect(notifier.shown.at(-1)?.title).toBe('Avisos de MVP en pausa');
    expect((await userData.getAlerts('ivan')).watchSessionId).toBeNull();
  });

  it('un fallo de Telegram no impide los demás avisos', async () => {
    const auth = await loginAs(app, pool);
    await connectTelegram(auth);
    await send('PUT', '/api/alerts/mvps/1', auth, { channel: 'windows' });
    await send('PUT', '/api/alerts/mvps/2', auth, { channel: 'telegram' });
    mockMvpTimer(1);
    telegramReply('sendMessage', null, 403);
    expect(await watcherFor().checkUser('ivan')).toBe(1);
    expect(notifier.shown[0]?.title).toBe('Baphomet puede aparecer ya');
  });
});

describe('avisos fuera de la app de escritorio', () => {
  it('sin Windows sigue permitiendo Telegram', async () => {
    const { agent, pool } = createMockHikari();
    const { app } = await createTestApp(agent);
    const auth = await loginAs(app, pool);
    const headers = { cookie: auth.cookie, origin: APP_ORIGIN, 'x-csrf-token': auth.csrf };
    const config = await app.inject({ method: 'GET', url: '/api/alerts/config', headers });
    expect(config.json()).toMatchObject({ windowsAvailable: false });
    const test = await app.inject({
      method: 'POST',
      url: '/api/alerts/test',
      headers,
      payload: { channel: 'windows' },
    });
    expect(test.statusCode).toBe(404);
    await app.close();
    await agent.close();
  });
});

describe('datos de versiones anteriores', () => {
  it('convierte los favoritos con avisos en avisos por Windows', async () => {
    const store = new MemoryUserDataStore({
      favorites: { ivan: [1039, 1511] },
      alerts: { ivan: { enabled: true, leadMinutes: 10, watchSessionId: 's1' } },
      claims: {},
    });
    expect(await store.getAlerts('ivan')).toMatchObject({
      channels: { '1039': 'windows', '1511': 'windows' },
      telegram: null,
    });
    expect(await store.alertUsers()).toEqual(['ivan']);
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
    await first.setAlerts('ivan', {
      enabled: true,
      leadMinutes: 10,
      watchSessionId: 's1',
      channels: { '1039': 'telegram' },
      telegram: null,
    });
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
