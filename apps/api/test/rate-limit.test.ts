import { describe, expect, it } from 'vitest';
import { APP_ORIGIN, createMockHikari, createTestApp } from './helpers.js';

async function statuses(count: number, run: () => Promise<{ statusCode: number }>) {
  const seen: number[] = [];
  for (let index = 0; index < count; index += 1) seen.push((await run()).statusCode);
  return seen;
}

describe('límite de peticiones', () => {
  it('por defecto limita todas las rutas de la API', async () => {
    const { agent } = createMockHikari();
    const { app } = await createTestApp(agent);
    const seen = await statuses(301, () => app.inject({ method: 'GET', url: '/api/info' }));
    expect(seen.at(-1)).toBe(429);
    await app.close();
    await agent.close();
  });

  it('en la app de escritorio solo limita el login', async () => {
    const { agent } = createMockHikari();
    const { app } = await createTestApp(agent, { env: { RATE_LIMIT_PER_MINUTE: 0 } });

    const info = await statuses(350, () => app.inject({ method: 'GET', url: '/api/info' }));
    expect(new Set(info)).toEqual(new Set([200]));

    // LOGIN_MAX_ATTEMPTS = 3 en los tests → 6 intentos por IP y ventana.
    const logins = await statuses(7, () =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: '', password: '' },
        headers: { origin: APP_ORIGIN },
      }),
    );
    expect(logins.at(-1)).toBe(429);
    await app.close();
    await agent.close();
  });
});
