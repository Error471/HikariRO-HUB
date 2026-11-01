/**
 * Importa la copia local de la wiki (las páginas HTML de HikariRO_Web/Wiki) al formato que lee la API:
 *   - apps/api/src/modules/wiki/data/wiki-pages.json   contenido, secciones, avisos y grupos
 *   - apps/web/public/wiki-img/                        imágenes que usan las páginas
 *
 * Uso:  pnpm --filter @hikari-hub/api wiki:import [carpeta-con-la-copia]
 * La carpeta por defecto es ../../HikariRO_Web (junto a la carpeta del proyecto). Debe contener Wiki/ y assets/.
 */
import * as cheerio from 'cheerio';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = resolve(process.argv[2] ?? join(root, '..', '..', 'HikariRO_Web'));
const wikiDir = join(source, 'Wiki');
const dataFile = join(root, 'apps', 'api', 'src', 'modules', 'wiki', 'data', 'wiki-pages.json');
const imagesOut = join(root, 'apps', 'web', 'public', 'wiki-img');
const MAIN_PAGE = 'Página principal';

if (!existsSync(join(wikiDir, 'index.html'))) {
  console.error(`No encuentro ${join(wikiDir, 'index.html')}. Indica la carpeta de la copia local de la wiki.`);
  process.exit(1);
}

const text = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
const wikiPath = (title: string) =>
  `/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`;

interface Notice {
  kind: 'warn' | 'build' | 'off' | 'old';
  label: string;
  text: string;
}

interface Parsed {
  slug: string;
  h1: string;
  $: cheerio.CheerioAPI;
}

const files = readdirSync(wikiDir).filter((name) => name.endsWith('.html'));
const parsed = new Map<string, Parsed>();
for (const file of files) {
  const $ = cheerio.load(readFileSync(join(wikiDir, file), 'utf8'));
  const slug = basename(file, '.html');
  parsed.set(slug, { slug, h1: text($('.wk-head h1').first().text()), $ });
}

// Grupos y títulos visibles: salen del directorio de la portada (que también conoce las tarjetas deshabilitadas).
const home = parsed.get('index');
if (!home) throw new Error('Falta index.html');
const byH1 = new Map([...parsed.values()].filter((p) => p.h1).map((p) => [normalize(p.h1), p.slug]));
const titleBySlug = new Map<string, string>();
const groups: { name: string; pages: string[] }[] = [];
home.$('.wk-dir-group').each((_, element) => {
  const group = home.$(element);
  const name = text(group.children('b').first().text());
  const pages: string[] = [];
  group.find('.wk-card').each((__, cardElement) => {
    const card = home.$(cardElement);
    const label = text(card.children('b').first().text());
    const href = card.attr('href') ?? '';
    const slug = /^([\w-]+)\.html$/.exec(href)?.[1] ?? byH1.get(normalize(label));
    if (!slug || !parsed.has(slug) || !label) return;
    titleBySlug.set(slug, label);
    pages.push(label);
  });
  if (name && pages.length) groups.push({ name, pages });
});
titleBySlug.set('index', MAIN_PAGE);

const imagesUsed = new Set<string>();

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function convertHtml($: cheerio.CheerioAPI, scope: ReturnType<cheerio.CheerioAPI>) {
  scope.find('a[href]').each((_, element) => {
    const link = $(element);
    const href = link.attr('href') ?? '';
    const match = /^([\w-]+)\.html(#.*)?$/.exec(href);
    if (match) {
      const title = titleBySlug.get(match[1] ?? '');
      if (title) link.attr('href', wikiPath(title) + (match[2] ?? '')).attr('data-wiki', 'article');
      else link.replaceWith($('<span></span>').text(link.text()));
    } else if (/^https?:/.test(href)) {
      link.attr('target', '_blank').attr('rel', 'noopener noreferrer nofollow');
    }
  });
  scope.find('img').each((_, element) => {
    const image = $(element);
    const src = image.attr('src') ?? '';
    const local = /^img\/([^/]+)$/.exec(src)?.[1];
    if (!local) return;
    imagesUsed.add(local);
    image.attr('src', `/wiki-img/${local}`);
  });
}

const pages = [] as {
  title: string;
  group: string | null;
  html: string;
  sections: { level: number; title: string; anchor: string }[];
  notice: Notice | null;
  text: string;
}[];

for (const { slug, $ } of parsed.values()) {
  const title = titleBySlug.get(slug);
  if (!title) continue; // páginas que no están en el directorio no forman parte de la wiki
  const isHome = slug === 'index';
  const article = isHome ? $('.wk-home').first() : $('.wk-article').first();

  let notice: Notice | null = null;
  const noticeBox = article.find('.wk-notice').first();
  if (noticeBox.length) {
    const kind = /wk-notice-(\w+)/.exec(noticeBox.attr('class') ?? '')?.[1] as Notice['kind'] | undefined;
    notice = {
      kind: kind ?? 'warn',
      label: text(noticeBox.find('b').first().text()),
      text: text(noticeBox.find('span').first().text()),
    };
    noticeBox.remove();
  }
  if (isHome) {
    // El directorio de guías lo da la propia app (categorías y búsqueda).
    article.find('.wk-dir-group').remove();
    article.find('.hro2-section-head').filter((_, e) => $(e).text().includes('Todas las guías')).remove();
  }

  convertHtml($, article);

  const sections = $('.wk-toc li')
    .toArray()
    .map((element) => {
      const item = $(element);
      const anchor = safeDecode((item.find('a').attr('href') ?? '').replace(/^#/, ''));
      return { level: item.hasClass('l3') ? 3 : 2, title: text(item.text()), anchor };
    })
    .filter((section) => section.anchor);

  const group = isHome ? null : (groups.find((g) => g.pages.includes(title))?.name ?? null);
  pages.push({
    title,
    group,
    html: article.html()?.trim() ?? '',
    sections: isHome ? [] : sections,
    notice,
    text: text(article.text()),
  });
}

pages.sort((a, b) => (a.title === MAIN_PAGE ? -1 : b.title === MAIN_PAGE ? 1 : a.title.localeCompare(b.title, 'es')));

mkdirSync(dirname(dataFile), { recursive: true });
writeFileSync(dataFile, JSON.stringify({ groups, pages }) + '\n');

// Imágenes: solo las que usan las páginas (más la ilustración de la portada).
rmSync(imagesOut, { recursive: true, force: true });
mkdirSync(imagesOut, { recursive: true });
let copied = 0;
for (const name of imagesUsed) {
  const from = join(wikiDir, 'img', name);
  if (!existsSync(from)) {
    console.warn(`Falta la imagen ${name}`);
    continue;
  }
  copyFileSync(from, join(imagesOut, name));
  copied += 1;
}
const hero = join(source, 'assets', 'img', 'hero-slide.webp');
if (existsSync(hero)) copyFileSync(hero, join(imagesOut, 'hero-slide.webp'));

console.log(`${pages.length} páginas en ${groups.length} categorías, ${copied} imágenes copiadas.`);
