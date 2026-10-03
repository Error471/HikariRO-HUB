import type { FastifyInstance } from 'fastify';
import type { MockAgent } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { classifyLink, rewriteWikiHtml, sanitizeWikiHtml } from '../src/modules/wiki/wiki-html.js';
import { parseSnippet } from '../src/modules/wiki/wiki-snippet.js';
import { createMockHikari, createTestApp, fixture, HIKARI, loginAs } from './helpers.js';

const options = { origin: HIKARI, indexPath: '/wiki/index.php' };
const render = (html: string) => sanitizeWikiHtml(rewriteWikiHtml(html, options));
const rawHtml = (JSON.parse(fixture('wiki-parse.json')) as { parse: { text: string } }).parse.text;

describe('classifyLink', () => {
  it('distingue artículos, categorías y archivos', () => {
    expect(classifyLink('/wiki/index.php?title=VIP_System#Ventajas', options)).toEqual({
      kind: 'article',
      title: 'VIP System',
      hash: '#Ventajas',
    });
    expect(classifyLink('/wiki/index.php?title=Categor%C3%ADa:Gu%C3%ADas', options)).toEqual({
      kind: 'category',
      name: 'Guías',
    });
    expect(classifyLink('/wiki/index.php?title=Archivo:Fishing.png', options)).toEqual({
      kind: 'external',
      href: `${HIKARI}/wiki/index.php?title=Archivo:Fishing.png`,
    });
    expect(classifyLink('#Ventajas', options)).toBeNull();
    expect(classifyLink('javascript:alert(1)', options)).toEqual({ kind: 'invalid' });
  });
});

describe('HTML de la wiki', () => {
  const html = render(rawHtml);

  it('reescribe los enlaces internos a rutas de la app', () => {
    expect(html).toMatch(/<a href="\/wiki\/Sistema_de_mineria"[^>]*data-wiki="article"/);
    expect(html).toContain('href="/wiki/VIP_System#Ventajas"');
    expect(html).toMatch(/<a href="\/wiki\/categoria\/Gu%C3%ADas"[^>]*data-wiki="category"/);
  });

  it('abre los enlaces externos en otra pestaña de forma segura', () => {
    const link = /<a[^>]*id=50063[^>]*>/.exec(html)?.[0] ?? '';
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer nofollow"');
  });

  it('convierte los enlaces rotos en texto', () => {
    expect(html).toContain('<span class="mw-redlink">rota</span>');
    expect(html).not.toContain('redlink=1');
  });

  it('usa URLs absolutas en las imágenes', () => {
    expect(html).toContain(`src="${HIKARI}/wiki/images/thumb/1/19/Fishing.png/250px-Fishing.png"`);
    expect(html).toContain(
      `srcset="${HIKARI}/wiki/images/thumb/1/19/Fishing.png/375px-Fishing.png 1.5x"`,
    );
    expect(html).toContain('loading="lazy"');
  });

  it('elimina scripts, manejadores de eventos y URLs peligrosas', () => {
    expect(html).not.toMatch(/<script|onerror|javascript:|alert\(1\)<\/script>/);
    expect(html).toContain('<span>x</span>');
  });

  it('conserva los estilos del contenido salvo los peligrosos', () => {
    expect(html).toContain('background:linear-gradient(135deg,#123d52 0%,#28a2a0 100%)');
    expect(html).not.toContain('position:fixed');
    expect(html).not.toContain('evil.test');
    expect(html).toContain('color:#174f68');
  });

  it('solo permite clases de MediaWiki y HikariRO', () => {
    expect(html).toContain('class="hro2-card wikitable"');
    expect(html).not.toMatch(/class="[^"]*\b(fixed|hidden)\b/);
  });
});

describe('parseSnippet', () => {
  it('limpia el wikitexto y marca las coincidencias', () => {
    const raw =
      "&lt;div style=&quot;font-size:32px&quot;&gt;Sistema de <span class='searchmatch'>pesca</span> de HikariRO&lt;/div&gt;\n…se equipa en la '''mano derecha''' y [[Pesca|pesca]].";
    expect(parseSnippet(raw)).toEqual([
      { text: 'Sistema de ', match: false },
      { text: 'pesca', match: true },
      { text: ' de HikariRO …se equipa en la mano derecha y pesca.', match: false },
    ]);
  });
});

describe('rutas /api/wiki', () => {
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
  const json = { headers: { 'content-type': 'application/json; charset=utf-8' } };

  it('devuelve una página saneada con secciones y categorías', async () => {
    pool
      .intercept({
        path: (path) => path.includes('action=parse') && path.includes('page=Pesca&'),
        method: 'GET',
      })
      .reply(200, fixture('wiki-parse.json'), json);

    const response = await get('/api/wiki/page?title=Pesca');
    expect(response.statusCode).toBe(200);
    const page = response.json();
    expect(page).toMatchObject({
      title: 'Sistema de pesca',
      redirectedFrom: 'Pesca',
      revisionId: 2100,
      sections: [{ level: 2, title: 'Primeros pasos', anchor: 'Primeros_pasos' }],
      categories: ['Guías'],
      sourceUrl: `${HIKARI}/wiki/index.php?title=Sistema_de_pesca`,
    });
    expect(page.html).not.toContain('<script');
  });

  it('responde 404 si la página no existe', async () => {
    pool
      .intercept({ path: (path) => path.includes('action=parse'), method: 'GET' })
      .reply(200, JSON.stringify({ error: { code: 'missingtitle', info: 'x' } }), json);

    const response = await get('/api/wiki/page?title=No_existe');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.message).toBe('Esta página no existe en la wiki.');
  });

  it('rechaza títulos inválidos', async () => {
    const response = await get('/api/wiki/page?title=%3Cscript%3E');
    expect(response.statusCode).toBe(422);
  });

  it('busca por título y por contenido', async () => {
    pool.intercept({ path: (path) => path.includes('list=search'), method: 'GET' }).reply(
      200,
      JSON.stringify({
        query: {
          searchinfo: { totalhits: 1 },
          search: [
            {
              title: 'Sistema de pesca',
              snippet: "Sistema de <span class='searchmatch'>pesca</span>",
              timestamp: '2026-09-12T13:31:14Z',
              wordcount: 2717,
            },
          ],
          prefixsearch: [{ ns: 0, title: 'Pesca' }],
        },
      }),
      json,
    );

    const response = await get('/api/wiki/search?q=pesca');
    expect(response.json()).toEqual({
      query: 'pesca',
      titles: ['Pesca'],
      total: 1,
      results: [
        {
          title: 'Sistema de pesca',
          snippet: [
            { text: 'Sistema de ', match: false },
            { text: 'pesca', match: true },
          ],
          updatedAt: '2026-09-12T13:31:14Z',
          words: 2717,
        },
      ],
    });
  });

  it('oculta las categorías de mantenimiento', async () => {
    pool.intercept({ path: (path) => path.includes('list=allcategories'), method: 'GET' }).reply(
      200,
      JSON.stringify({
        query: {
          allcategories: [
            { category: 'Guías', pages: 21 },
            { category: 'Páginas con enlaces rotos a archivos', pages: 2 },
            { category: 'Plantillas', pages: 3 },
            { category: 'Vacía', pages: 0 },
          ],
        },
      }),
      json,
    );

    const response = await get('/api/wiki/categories');
    expect(response.json()).toEqual({ categories: [{ name: 'Guías', pages: 21 }] });
  });

  it('separa páginas y subcategorías', async () => {
    pool.intercept({ path: (path) => path.includes('list=categorymembers'), method: 'GET' }).reply(
      200,
      JSON.stringify({
        query: {
          categorymembers: [
            { ns: 0, title: 'Sistema de pesca' },
            { ns: 14, title: 'Categoría:Pesca avanzada' },
          ],
        },
      }),
      json,
    );

    const response = await get('/api/wiki/categories/Gu%C3%ADas');
    expect(response.json()).toEqual({
      name: 'Guías',
      pages: ['Sistema de pesca'],
      subcategories: ['Pesca avanzada'],
    });
  });
});
