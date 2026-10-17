import { MockAgent } from 'undici';
import { afterEach, describe, expect, it } from 'vitest';
import { HikariClient } from '../src/hikari/hikari-client.js';

const ORIGIN = 'https://hikariro.test';
const CRITICAL =
  "<html><head><title>rA's Flux Control Panel: Critical Error</title></head><body></body></html>";
const MINUTE = 60_000;

let agent: MockAgent;

afterEach(async () => {
  await agent.close();
});

function setup() {
  agent = new MockAgent();
  agent.disableNetConnect();
  const pool = agent.get(ORIGIN);
  const clock = { now: 0 };
  const client = new HikariClient({
    baseUrl: ORIGIN,
    userAgent: 'test',
    timeoutMs: 2000,
    dispatcher: agent,
    retryDelayMs: 0,
    now: () => clock.now,
  });
  const reply = (body: string, times = 1) =>
    pool.intercept({ path: '/', method: 'GET' }).reply(200, body).times(times);
  return { client, clock, reply };
}

describe('pausa tras errores de servidor de HikariRO', () => {
  it('espera 30 s, 1, 2, 4, 5, 10 y 30 min, y repite 30 min', async () => {
    const { client, clock, reply } = setup();
    const steps = [0.5, 1, 2, 4, 5, 10, 30, 30].map((minutes) => minutes * MINUTE);

    for (const step of steps) {
      reply(CRITICAL, 3);
      await expect(client.get('/')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });

      clock.now += step - 1;
      await expect(client.get('/')).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
      expect(agent.pendingInterceptors()).toHaveLength(0);
      clock.now += 1;
    }
  });

  it('vuelve a empezar por 30 s cuando HikariRO responde bien', async () => {
    const { client, clock, reply } = setup();
    reply(CRITICAL, 3);
    await expect(client.get('/')).rejects.toThrow();
    clock.now += 30_000;
    reply(CRITICAL, 3);
    await expect(client.get('/')).rejects.toThrow();
    clock.now += MINUTE;
    reply('ok');
    await expect(client.get('/')).resolves.toMatchObject({ status: 200 });

    reply(CRITICAL, 3);
    await expect(client.get('/')).rejects.toThrow();
    clock.now += 30_000;
    reply('ok');
    await expect(client.get('/')).resolves.toMatchObject({ body: 'ok' });
  });
});
