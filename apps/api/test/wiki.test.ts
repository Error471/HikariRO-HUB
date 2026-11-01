import type { FastifyInstance } from 'fastify';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sanitizeWikiHtml } from '../src/modules/wiki/wiki-html.js';
import { WikiService } from '../src/modules/wiki/wiki.service.js';
import { createMockHikari, createTestApp, HIKARI, loginAs } from './helpers.js';
import { wikiTestData } from './wiki-data.js';

describe('HTML de la wiki', () => {
  const html = sanitizeWikiHtml(
    wikiTestData.pages.find((page) => page.title === 'Sistema de pesca')?.html ?? '',
  );

  it('conserva enlaces internos y abre los externos de forma segura', () => {
    expect(html).toContain('href="/wiki/Sistema_de_miner%C3%ADa#Pico"');
    expect(html).toContain('data-wiki="article"');
    const external = /<a[^>]*example\.test[^>]*>/.exec(html)?.[0] ?? '';
    expect(external).toContain('rel="noopener noreferrer nofollow"');
  });

  it('elimina scripts, manejadores de eventos y elementos peligrosos', () => {
    expect(html).not.toMatch(/<script|onerror|onload|alert\(1\)|<use/);
  });

  it('conserva los iconos SVG y los estilos seguros', () => {
    expect(html).toMatch(/<svg viewbox="0 0 24 24"><path d="M0 0h24">/);
    expect(html).toContain('background:linear-gradient(135deg,#123d52 0%,#28a2a0 100%)');
    expect(html).toContain('color:#174f68');
    expect(html).not.toContain('position:fixed');
  });

  it('solo permite clases de la wiki', () => {
    expect(html).toContain('class="hro2-card wikitable"');
    expect(html).toContain('class="wk-notice"');
    expect(html).not.toMatch(/class="[^"]*\b(fixed|hidden)\b/);
  });
});

describe('WikiService (copia de prueba)', () => {
  const wiki = new WikiService(HIKARI, wikiTestData);

  it('encuentra páginas sin distinguir mayúsculas, tildes ni guiones bajos', async () => {
    expect((await wiki.page('sistema_de_mineria')).title).toBe('Sistema de minería');
    expect((await wiki.page('Pagina principal')).title).toBe('Página principal');
  });

  it('devuelve categoría, secciones, aviso y enlace de búsqueda en la wiki original', async () => {
    const page = await wiki.page('Sistema de pesca');
    expect(page).toMatchObject({
      redirectedFrom: null,
      revisionId: null,
      categories: ['Zonas'],
      sections: [{ level: 2, title: 'Primeros pasos', anchor: 'Primeros_pasos' }],
      notice: { kind: 'off', label: 'Sistema antiguo' },
      sourceUrl: `${HIKARI}/wiki/index.php?search=Sistema%20de%20pesca`,
    });
  });

  it('busca por título y por contenido, ignorando tildes, y marca las coincidencias', async () => {
    const result = await wiki.search('pesca');
    expect(result.total).toBe(1);
    expect(result.results[0]?.title).toBe('Sistema de pesca');
    expect(
      result.results[0]?.snippet.some((part) => part.match && part.text.toLowerCase() === 'pesca'),
    ).toBe(true);

    expect((await wiki.search('Sistema')).titles).toEqual([
      'Sistema de minería',
      'Sistema de pesca',
    ]);
    expect((await wiki.search('cana')).results[0]?.title).toBe('Sistema de pesca');
    expect((await wiki.search('zzzz')).results).toEqual([]);
  });

  it('lista categorías y sus páginas', async () => {
    expect(await wiki.allCategories()).toEqual({
      categories: [
        { name: 'Zonas', pages: 2 },
        { name: 'Eventos', pages: 1 },
      ],
    });
    expect(await wiki.category('zonas')).toEqual({
      name: 'Zonas',
      pages: ['Sistema de pesca', 'Sistema de minería'],
      subcategories: [],
    });
    await expect(wiki.category('nada')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// La carpeta wiki/ del repositorio es lo que descargan las apps desde GitHub.
const published = (name: string) =>
  readFileSync(new URL(`../../../wiki/${name}`, import.meta.url), 'utf8');
const bundled = JSON.parse(published('pages.json')) as { pages: unknown[] };

describe('copia de la wiki publicada en GitHub', () => {
  const wiki = new WikiService(HIKARI, bundled);

  it('tiene la portada y sus enlaces internos apuntan a páginas que existen', async () => {
    const home = await wiki.page('Página principal');
    expect(home.html).toContain('hro2-hero');
    const titles = (await wiki.index()).pages.map((title) => title.toLowerCase());
    for (const [, path] of home.html.matchAll(/href="\/wiki\/([^"#]+)/g)) {
      const title = decodeURIComponent(path ?? '')
        .replace(/_/g, ' ')
        .toLowerCase();
      expect(titles, `enlace roto: ${title}`).toContain(title);
    }
  });

  it('solo usa imágenes y enlaces locales', async () => {
    for (const title of (await wiki.index()).pages) {
      const { html } = await wiki.page(title);
      expect(html, title).not.toMatch(/<img [^>]*src="(?!\/wiki-img\/)/);
      expect(html, title).not.toMatch(/href="[^"#]*\.html/);
    }
    expect(bundled.pages.length).toBeGreaterThan(20);
  });

  it('el manifiesto lista todas las imágenes que usan las páginas', () => {
    const manifest = JSON.parse(published('manifest.json')) as { images: Record<string, unknown> };
    const used = [...published('pages.json').matchAll(/\/wiki-img\/([^"\\]+)/g)].map(
      (match) => match[1] ?? '',
    );
    expect(used.length).toBeGreaterThan(50);
    for (const name of used) expect(Object.keys(manifest.images), name).toContain(name);
  });
});

describe('rutas /api/wiki', () => {
  let app: FastifyInstance;
  let wikiDir: string;
  let agent: MockAgent;
  let pool: ReturnType<MockAgent['get']>;
  let cookie: string;

  beforeEach(async () => {
    ({ agent, pool } = createMockHikari());
    ({ app, wikiDir } = await createTestApp(agent));
    ({ cookie } = await loginAs(app, pool));
  });

  afterEach(async () => {
    await app.close();
    await agent.close();
  });

  const get = (url: string, headers: Record<string, string> = { cookie }) =>
    app.inject({ method: 'GET', url, headers });

  it('se puede leer sin iniciar sesión', async () => {
    expect((await get('/api/wiki/index', {})).statusCode).toBe(200);
    expect((await get('/api/wiki/page?title=Sistema_de_pesca', {})).statusCode).toBe(200);
  });

  it('informa del estado de la descarga', async () => {
    expect((await get('/api/wiki/status', {})).json()).toMatchObject({
      state: 'ready',
      message: null,
    });
  });

  it('sirve las imágenes descargadas y rechaza nombres raros', async () => {
    mkdirSync(join(wikiDir, 'img'));
    writeFileSync(join(wikiDir, 'img', 'pez.png'), 'png');
    writeFileSync(join(wikiDir, 'manifest.json'), '{}');
    const image = await get('/wiki-img/pez.png', {});
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect((await get('/wiki-img/no-existe.png', {})).statusCode).toBe(404);
    expect((await get('/wiki-img/manifest.json', {})).statusCode).toBe(404);
    expect((await get('/wiki-img/..%2Fmanifest.json', {})).statusCode).toBe(404);
  });

  it('devuelve una página saneada', async () => {
    const response = await get('/api/wiki/page?title=Sistema_de_pesca');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ title: 'Sistema de pesca', categories: ['Zonas'] });
    expect(response.json().html).not.toContain('<script');
  });

  it('responde 404 si la página no existe', async () => {
    const response = await get('/api/wiki/page?title=No_existe');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.message).toBe('Esta página no existe en la wiki.');
  });

  it('rechaza títulos inválidos', async () => {
    expect((await get('/api/wiki/page?title=%3Cscript%3E')).statusCode).toBe(422);
  });

  it('busca, lista categorías y devuelve el índice', async () => {
    expect((await get('/api/wiki/search?q=halloween')).json().results[0].title).toBe('Halloween');
    expect((await get('/api/wiki/categories')).json().categories).toHaveLength(2);
    expect((await get('/api/wiki/categories/Eventos')).json().pages).toEqual(['Halloween']);
    expect((await get('/api/wiki/index')).json().pages).toHaveLength(4);
  });
});
