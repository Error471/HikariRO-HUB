/**
 * Sincroniza la wiki del Hub con la wiki online (https://hikariro.com/?module=wiki), que es pública.
 * Recorre las categorías y subcategorías, lee cada artículo y descarga sus imágenes. Escribe, en la carpeta
 * `wiki/` de la raíz del repositorio, lo que descargan las apps de GitHub:
 *   - wiki/pages.json      categorías (con padre), artículos, secciones, avisos y texto para la búsqueda
 *   - wiki/img/            imágenes de los artículos
 *   - wiki/manifest.json   versión y huella de cada archivo (la app solo baja lo que cambia)
 *
 * Uso:  pnpm --filter @hikari-hub/api wiki:sync
 * Después hay que subir los cambios a GitHub (rama main): las apps instaladas los descargan solas.
 */
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = (process.env.WIKI_SITE ?? 'https://hikariro.com').replace(/\/+$/, '');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outDir = join(root, 'wiki');
const imagesOut = join(outDir, 'img');
const USER_AGENT = 'HikariHub-wiki-sync/1.0';

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
const text = (value: string) => value.replace(/\s+/g, ' ').trim();
const wikiPath = (title: string) =>
  `/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`;

async function request(url: string): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${response.status} al pedir ${url}`);
      return response;
    } catch (error) {
      last = error;
      await wait(400 * attempt);
    }
  }
  throw last;
}

async function page(path: string) {
  const html = await (await request(`${SITE}${path}`)).text();
  await wait(120);
  return cheerio.load(html);
}

// ---------- categorías ----------
interface Category {
  id: number;
  name: string;
  parent: number | null;
  articles: { slug: string; title: string }[];
}

const categoryId = (href: string) => Number(/[?&]category=(\d+)/.exec(href)?.[1]);
const articleSlug = (href: string) =>
  decodeURIComponent(/[?&]article=([^&#]+)/.exec(href.replace(/&amp;/g, '&'))?.[1] ?? '');

const categories = new Map<number, Category>();

const home = await page('/?module=wiki&lang=es');
const queue: number[] = [];
home('a.wiki-home-category').each((_, element) => {
  const id = categoryId(home(element).attr('href') ?? '');
  if (!Number.isInteger(id)) return;
  categories.set(id, {
    id,
    name: text(home(element).find('strong').text()),
    parent: null,
    articles: [],
  });
  queue.push(id);
});
if (!queue.length)
  throw new Error('No encuentro categorías en la portada de la wiki: ¿ha cambiado la web?');

for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
  const $ = await page(`/?module=wiki&lang=es&category=${id}`);
  const category = categories.get(id);
  if (!category) continue;
  $('a.wiki-home-category').each((_, element) => {
    const child = categoryId($(element).attr('href') ?? '');
    if (!Number.isInteger(child) || child === id) return;
    const known = categories.get(child);
    if (known) known.parent = id;
    else {
      categories.set(child, {
        id: child,
        name: text($(element).find('strong').text()),
        parent: id,
        articles: [],
      });
      queue.push(child);
    }
  });
  $('a.wiki-home-article').each((_, element) => {
    const slug = articleSlug($(element).attr('href') ?? '');
    if (slug) category.articles.push({ slug, title: text($(element).find('strong').text()) });
  });
}

// La portada de la wiki oculta las categorías sin artículos propios aunque tengan subcategorías, y la página de
// una categoría no dice su propio nombre. Se buscan esos padres probando los números que faltan; sus nombres
// se leen de aquí (si aparece uno nuevo sin nombre se avisa y se usa «Categoría N»).
const HIDDEN_CATEGORY_NAMES: Record<number, string> = { 6: 'Equipo y encantos', 9: 'Instancias' };
const lastKnown = Math.max(...categories.keys());
for (let id = 1; id <= lastKnown + 5; id += 1) {
  if (categories.has(id)) continue;
  const $ = await page(`/?module=wiki&lang=es&category=${id}`);
  const childIds = $('a.wiki-home-category')
    .toArray()
    .map((element) => categoryId($(element).attr('href') ?? ''))
    .filter((child) => Number.isInteger(child) && child !== id && categories.has(child));
  if (!childIds.length) continue;
  const name = HIDDEN_CATEGORY_NAMES[id];
  if (!name)
    console.warn(
      `La categoría ${id} no aparece en la portada y no tiene nombre conocido: añádela a HIDDEN_CATEGORY_NAMES.`,
    );
  categories.set(id, { id, name: name ?? `Categoría ${id}`, parent: null, articles: [] });
  for (const child of childIds) {
    const known = categories.get(child);
    if (known) known.parent = id;
  }
}

// ---------- artículos ----------
interface Section {
  level: number;
  title: string;
  anchor: string;
}
interface Notice {
  kind: 'warn' | 'build' | 'off' | 'old';
  label: string;
  text: string;
}
interface Article {
  slug: string;
  title: string;
  category: Category;
  $: cheerio.CheerioAPI;
}

const articles: Article[] = [];
const bySlug = new Map<string, Article>();
for (const category of [...categories.values()].sort((a, b) => a.id - b.id)) {
  for (const { slug } of category.articles) {
    if (bySlug.has(slug)) continue;
    const $ = await page(`/?module=wiki&action=view&lang=es&article=${encodeURIComponent(slug)}`);
    const title = text($('.flux-wiki > h1').first().text() || $('h1').first().text());
    if (!title || !$('.wiki-article-content').length) {
      console.warn(`No se pudo leer el artículo ${slug}`);
      continue;
    }
    const article = { slug, title, category, $ };
    articles.push(article);
    bySlug.set(slug, article);
  }
}
const titles = new Set<string>();
for (const { title } of articles) {
  if (titles.has(title)) throw new Error(`Hay dos artículos con el título «${title}»`);
  titles.add(title);
}

// ---------- imágenes ----------
mkdirSync(imagesOut, { recursive: true });
const existing = new Map(readdirSync(imagesOut).map((name) => [name.slice(0, 8), name]));
const imageNames = new Map<string, string | null>(); // URL → nombre local (null = no se pudo descargar)
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

async function downloadImage(url: string): Promise<string | null> {
  const key = createHash('sha1').update(url).digest('hex').slice(0, 8);
  const cached = existing.get(key);
  if (cached) return cached;
  try {
    const response = await request(url);
    const type =
      (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    const extension = EXTENSIONS[type];
    if (!extension) throw new Error(`no es una imagen (${type})`);
    const stem =
      decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'img')
        .replace(/\.[A-Za-z0-9]+$/, '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .slice(0, 60)
        .replace(/^[._-]+|[._-]+$/g, '') || 'img';
    const name = `${key}-${stem}.${extension}`;
    writeFileSync(join(imagesOut, name), Buffer.from(await response.arrayBuffer()));
    return name;
  } catch (error) {
    console.warn(`Imagen no disponible: ${url} (${(error as Error).message})`);
    return null;
  }
}

const imageUrls = new Set<string>();
const absolute = (value: string) => {
  try {
    return new URL(value.replace(/&amp;/g, '&'), `${SITE}/`).href;
  } catch {
    return null;
  }
};
for (const { $ } of articles) {
  $('.wiki-article-content img[src]').each((_, element) => {
    const url = absolute($(element).attr('src') ?? '');
    if (url?.startsWith('http')) imageUrls.add(url);
  });
}
const pending = [...imageUrls];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let url = pending.shift(); url; url = pending.shift())
      imageNames.set(url, await downloadImage(url));
  }),
);

// ---------- conversión ----------
function noticeFrom($: cheerio.CheerioAPI, content: cheerio.Cheerio<never>): Notice | null {
  const box = content.children('.wiki-callout').first();
  const label = text(box.find('strong').first().text()).replace(/[.:]\s*$/, '');
  if (!box.length || !label) return null;
  const body = text(box.text())
    .slice(text(box.find('strong').first().text()).length)
    .trim();
  box.remove();
  const key = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const kind: Notice['kind'] = key.includes('construccion')
    ? 'build'
    : key.includes('deshabilit') || key.includes('sistema antiguo')
      ? 'off'
      : key.includes('evento antiguo')
        ? 'old'
        : 'warn';
  return { kind, label, text: body };
}

const anchorOf = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'seccion';

let removedImages = 0;
const pages = articles.map(({ $, slug, title, category }) => {
  const content = $('.wiki-article-content').first() as cheerio.Cheerio<never>;
  const notice = noticeFrom($, content);

  content.find('img').each((_, element) => {
    const image = $(element);
    const url = absolute(image.attr('src') ?? '');
    const local = url ? imageNames.get(url) : null;
    const wrapper = image.parent('a');
    if (!local) {
      removedImages += 1;
      if (wrapper.length && !text(wrapper.text())) wrapper.remove();
      else image.remove();
      return;
    }
    image.attr('src', `/wiki-img/${local}`);
    for (const attribute of ['srcset', 'loading', 'referrerpolicy', 'decoding'])
      image.removeAttr(attribute);
    image.attr('loading', 'lazy');
  });

  content.find('a[href]').each((_, element) => {
    const link = $(element);
    const href = (link.attr('href') ?? '').replace(/&amp;/g, '&');
    if (href.startsWith('#') || href.startsWith('mailto:')) return;
    const slug = /[?&]module=wiki\b/.test(href) ? articleSlug(href) : '';
    if (slug) {
      const target = bySlug.get(slug);
      if (!target) {
        link.replaceWith(link.contents());
        return;
      }
      const fragment = href.includes('#') ? href.slice(href.indexOf('#')) : '';
      link.attr('href', wikiPath(target.title) + fragment).attr('data-wiki', 'article');
      link.removeAttr('target').removeAttr('rel');
      return;
    }
    const url = absolute(href);
    if (!url?.startsWith('http')) {
      link.replaceWith(link.contents());
      return;
    }
    link.attr('href', url).attr('target', '_blank').attr('rel', 'noopener noreferrer');
  });

  const sections: Section[] = [];
  const used = new Set<string>();
  content.find('h2, h3').each((_, element) => {
    const heading = $(element);
    const label = text(heading.text());
    if (!label) {
      heading.remove();
      return;
    }
    let anchor = anchorOf(label);
    for (let n = 2; used.has(anchor); n += 1) anchor = `${anchorOf(label)}_${n}`;
    used.add(anchor);
    heading.attr('id', anchor);
    sections.push({ level: element.tagName === 'h3' ? 3 : 2, title: label, anchor });
  });

  return {
    title,
    slug,
    group: category.name,
    html: (content.html() ?? '').trim(),
    sections,
    notice,
    text: text(content.text()),
  };
});

// ---------- salida ----------
const children = (parent: number | null) =>
  [...categories.values()]
    .filter((category) => category.parent === parent)
    .sort((a, b) => a.id - b.id);
const groups: { name: string; parent: string | null; pages: string[] }[] = [];
const walk = (category: Category) => {
  const parent = category.parent === null ? null : (categories.get(category.parent)?.name ?? null);
  groups.push({
    name: category.name,
    parent,
    pages: category.articles.flatMap(({ slug }) => bySlug.get(slug)?.title ?? []),
  });
  children(category.id).forEach(walk);
};
children(null).forEach(walk);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'pages.json'), JSON.stringify({ groups, pages }) + '\n');

const fingerprint = (data: Buffer) => ({
  sha256: createHash('sha256').update(data).digest('hex'),
  size: data.length,
});
const usedImages = new Set(
  [...imageNames.values()].filter((name): name is string => name !== null),
);
for (const name of readdirSync(imagesOut)) {
  if (!usedImages.has(name)) rmSync(join(imagesOut, name), { force: true });
}
const images: Record<string, ReturnType<typeof fingerprint>> = {};
for (const name of [...usedImages].sort())
  images[name] = fingerprint(readFileSync(join(imagesOut, name)));
const pagesEntry = fingerprint(readFileSync(join(outDir, 'pages.json')));
// La versión cambia solo si cambia algún archivo.
const version = createHash('sha256')
  .update(JSON.stringify([pagesEntry, images]))
  .digest('hex')
  .slice(0, 16);
writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify({ version, pages: pagesEntry, images }) + '\n',
);

console.log(
  `${pages.length} artículos en ${groups.length} categorías, ${usedImages.size} imágenes ` +
    `(${removedImages} referencias sin imagen disponible quitadas). Versión ${version}.`,
);
if (!existsSync(join(outDir, 'manifest.json'))) process.exit(1);
