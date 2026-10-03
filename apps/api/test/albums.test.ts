import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCardAlbum, parseFishingAlbum } from '../src/modules/albums/album-parser.js';
import { createMockHikari, createTestApp, fixture, HIKARI, loginAs } from './helpers.js';

describe('parseCardAlbum', () => {
  it('extrae progreso, paginación y cartas', () => {
    const page = parseCardAlbum(fixture('cards-album.html'), HIKARI);
    expect(page.progress).toEqual({ obtained: 2, total: 1468 });
    expect(page.results).toBe(43);
    expect(page.pages).toBe(3);
    expect(page.cards).toEqual([
      {
        id: 4001,
        name: 'Poring Card',
        imageUrl: `${HIKARI}/data/items/images/4001.png`,
        iconUrl: `${HIKARI}/data/items/icons/4001.png`,
        detailUrl: `${HIKARI}/?module=item&action=view&id=4001`,
        obtained: true,
      },
      expect.objectContaining({ id: 4003, name: 'Pupa Card', obtained: false }),
      expect.objectContaining({ id: 4005, obtained: true }),
    ]);
  });

  it('acepta búsquedas sin resultados', () => {
    const page = parseCardAlbum(fixture('cards-album-empty.html'), HIKARI);
    expect(page).toMatchObject({
      progress: { obtained: 275, total: 1468 },
      results: 0,
      pages: 0,
      cards: [],
    });
  });

  it('detecta cambios de estructura', () => {
    expect(() => parseCardAlbum('<html><body>Mantenimiento</body></html>', HIKARI)).toThrow();
  });
});

describe('parseFishingAlbum', () => {
  const album = parseFishingAlbum(fixture('fishing-album.html'), HIKARI);

  it('extrae el progreso', () => {
    expect(album.progress).toEqual({ obtained: 3, total: 80 });
  });

  it('extrae los datos de cada especie descubierta', () => {
    expect(album.fish[0]).toEqual({
      discovered: true,
      itemId: 579,
      name: 'Fresh Fish',
      imageUrl: `${HIKARI}/data/items/images/579.png`,
      iconUrl: `${HIKARI}/data/items/icons/579.png`,
      stars: 5,
      sizeCm: 43.13,
      weightKg: 1.125,
      catches: 31,
      bestMap: null,
    });
    expect(album.fish[1]).toMatchObject({ stars: 3, catches: 1, bestMap: 'prt_fild08' });
  });

  it('no revela el nombre de las especies sin descubrir', () => {
    expect(album.fish[2]).toEqual({
      discovered: false,
      imageUrl: `${HIKARI}/data/items/images/6773.png`,
    });
  });

  it('conserva imágenes inline cuando no hay ruta', () => {
    expect(album.fish[3]).toMatchObject({
      name: 'Mud Catfish',
      itemId: null,
      iconUrl: null,
      stars: 4,
    });
  });
});

describe('rutas /api/albums', () => {
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
  const html = { headers: { 'content-type': 'text/html' } };

  it('traduce los filtros de la app a los parámetros de HikariRO y usa la sesión del usuario', async () => {
    pool
      .intercept({
        path: (path) =>
          path.includes('module=cartaslog') &&
          path.includes('status=found') &&
          path.includes('type_order=1') &&
          path.includes('q=poring') &&
          path.includes('p=2'),
        method: 'GET',
        headers: { cookie: 'fluxSessionData=auth456' },
      })
      .reply(200, fixture('cards-album.html'), html);

    const response = await get('/api/albums/cards?status=found&sort=name&q=poring&page=2');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ page: 2, pages: 3, pageSize: 20, results: 43 });
  });

  it('valida los filtros', async () => {
    const response = await get('/api/albums/cards?status=todas');
    expect(response.statusCode).toBe(422);
  });

  it('cierra la sesión si HikariRO la ha invalidado', async () => {
    pool
      .intercept({ path: '/?module=fishingalbum', method: 'GET' })
      .reply(302, '', { headers: { location: '/?module=account&action=login&return_url=x' } });

    const response = await get('/api/albums/fishing');
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('SESSION_EXPIRED');
  });

  it('devuelve el álbum de pesca', async () => {
    pool
      .intercept({ path: '/?module=fishingalbum', method: 'GET' })
      .reply(200, fixture('fishing-album.html'), html);
    const response = await get('/api/albums/fishing');
    expect(response.statusCode).toBe(200);
    expect(response.json().fish).toHaveLength(4);
  });
});
