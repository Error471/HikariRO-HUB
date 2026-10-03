import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockHikari, createTestApp, loginAs, mockMarkets } from './helpers.js';

let app: FastifyInstance;
let agent: MockAgent;
let pool: ReturnType<MockAgent['get']>;
let cookie: string;

beforeEach(async () => {
  ({ agent, pool } = createMockHikari());
  ({ app } = await createTestApp(agent));
  ({ cookie } = await loginAs(app, pool));
});

afterEach(async () => {
  await app.close();
  await agent.close();
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });

describe('GET /api/markets/:type', () => {
  it('devuelve las tiendas con sus items y reutiliza la instantánea', async () => {
    mockMarkets(pool);
    const vending = await get('/api/markets/vending');
    expect(vending.statusCode).toBe(200);
    const body = vending.json();
    expect(body.shops).toHaveLength(2);
    expect(body.shops[0]).toMatchObject({ id: 1, owner: 'Ayla', items: [{}, {}] });

    // Buying Store sale de la misma instantánea: el mock no responde dos veces.
    const buying = await get('/api/markets/buying');
    expect(buying.json().shops[0]).toMatchObject({ owner: 'SELLpee', items: [{ amount: 160 }] });
  });

  it('omite las tiendas que se cierran durante la lectura', async () => {
    mockMarkets(pool, { closedShop: true });
    const response = await get('/api/markets/vending');
    expect(response.json().shops.map((shop: { id: number }) => shop.id)).toEqual([1]);
  });

  it('valida el tipo de mercado', async () => {
    const response = await get('/api/markets/otro');
    expect(response.statusCode).toBe(422);
  });

  it('exige sesión', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/markets/vending' });
    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/markets/:type/:shopId', () => {
  it('devuelve una tienda o un 404 comprensible', async () => {
    mockMarkets(pool);
    const shop = await get('/api/markets/vending/4');
    expect(shop.json().shop.items[0]).toMatchObject({ name: 'Gray Wolf Suit', refine: 15 });

    const missing = await get('/api/markets/vending/999');
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.message).toContain('cerrado');
  });
});

describe('GET /api/markets/search', () => {
  it('busca en ambos mercados', async () => {
    mockMarkets(pool);
    const response = await get('/api/markets/search?q=blessing');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.vending).toEqual([]);
    expect(body.buying[0]).toMatchObject({
      item: { name: 'Blacksmith Blessing', unitPrice: 130_000, amount: 160 },
      shop: { owner: 'SELLpee', map: 'veil' },
    });
  });

  it('exige al menos 2 caracteres', async () => {
    const response = await get('/api/markets/search?q=a');
    expect(response.statusCode).toBe(422);
    expect(response.json().error.message).toContain('2 caracteres');
  });

  it('informa si HikariRO no responde', async () => {
    pool.intercept({ path: '/?module=vending', method: 'GET' }).reply(503, 'down');
    pool.intercept({ path: '/?module=buyingstore', method: 'GET' }).reply(503, 'down');
    const response = await get('/api/markets/search?q=potion');
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
