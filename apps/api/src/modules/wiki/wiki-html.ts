import { wikiCategoryPath, wikiPath } from '@hikari-hub/shared';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';

/** Prefijos de espacio de nombres de la wiki (español e inglés, observados en siteinfo). */
const CATEGORY_PREFIXES = ['Categoría:', 'Category:'];
const NON_ARTICLE_PREFIXES = [
  'Archivo:',
  'File:',
  'Especial:',
  'Special:',
  'Plantilla:',
  'Template:',
  'Usuario:',
  'User:',
  'MediaWiki:',
  'Ayuda:',
  'Help:',
  'Medio:',
  'Media:',
  'HikariRO Wiki:',
  'Project:',
];

export interface RewriteOptions {
  /** Origen de HikariRO, p. ej. https://hikariro.com */
  origin: string;
  /** Ruta del index.php de la wiki, p. ej. /wiki/index.php */
  indexPath: string;
}

type LinkTarget =
  | { kind: 'invalid' }
  | { kind: 'article'; title: string; hash: string }
  | { kind: 'category'; name: string }
  | { kind: 'external'; href: string };

/** Clasifica un enlace del HTML de MediaWiki. */
export function classifyLink(href: string, options: RewriteOptions): LinkTarget | null {
  if (href.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(href, options.origin);
  } catch {
    return { kind: 'invalid' };
  }
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return { kind: 'invalid' };
  const isWiki = url.origin === options.origin && url.pathname === options.indexPath;
  const title = isWiki ? url.searchParams.get('title') : null;
  const hasOnlyTitle = isWiki && [...url.searchParams.keys()].every((key) => key === 'title');

  if (!title || !hasOnlyTitle) return { kind: 'external', href: url.href };

  const readable = title.replace(/_/g, ' ');
  const category = CATEGORY_PREFIXES.find((prefix) => readable.startsWith(prefix));
  if (category) return { kind: 'category', name: readable.slice(category.length) };
  if (NON_ARTICLE_PREFIXES.some((prefix) => readable.startsWith(prefix))) {
    return { kind: 'external', href: url.href };
  }
  return { kind: 'article', title: readable, hash: url.hash };
}

function absolutize(src: string, origin: string): string | null {
  try {
    const url = new URL(src, origin);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Reescribe el HTML de MediaWiki para la app: artículos y categorías → rutas internas,
 * el resto → enlaces externos; imágenes con URL absoluta; enlaces rotos → texto.
 * El contenido no se modifica.
 */
export function rewriteWikiHtml(html: string, options: RewriteOptions): string {
  const $ = cheerio.load(html, null, false);

  $('a.new').each((_, element) => {
    $(element).replaceWith($('<span class="mw-redlink"></span>').text($(element).text()));
  });

  $('a[href]').each((_, element) => {
    const link = $(element);
    const target = classifyLink(link.attr('href') ?? '', options);
    if (!target) return;
    if (target.kind === 'invalid') {
      link.replaceWith($('<span></span>').text(link.text()));
    } else if (target.kind === 'article') {
      link.attr('href', wikiPath(target.title) + target.hash).attr('data-wiki', 'article');
    } else if (target.kind === 'category') {
      link.attr('href', wikiCategoryPath(target.name)).attr('data-wiki', 'category');
    } else {
      link
        .attr('href', target.href)
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer nofollow');
    }
  });

  $('img').each((_, element) => {
    const image = $(element);
    const src = absolutize(image.attr('src') ?? '', options.origin);
    if (!src) {
      image.remove();
      return;
    }
    image.attr('src', src).attr('loading', 'lazy').attr('decoding', 'async');
    const srcset = image.attr('srcset');
    if (srcset) {
      const rewritten = srcset
        .split(',')
        .map((candidate) => {
          const [url = '', descriptor = ''] = candidate.trim().split(/\s+/);
          const absolute = absolutize(url, options.origin);
          return absolute ? `${absolute} ${descriptor}`.trim() : null;
        })
        .filter(Boolean)
        .join(', ');
      image.attr('srcset', rewritten);
    }
  });

  return $.html();
}

/** Solo valores CSS sin url(), expression() ni javascript:. */
const SAFE_CSS = /^(?!.*(?:url\s*\(|expression\s*\(|javascript:|@import|\\))[-#%.,()/\w\s"'!+*]*$/i;

const allowedCssProperties = [
  'color',
  'background',
  'background-color',
  'background-image',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'border-style',
  'border-width',
  'border-radius',
  'border-collapse',
  'border-spacing',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'text-align',
  'vertical-align',
  'font-size',
  'font-weight',
  'font-style',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-decoration',
  'text-transform',
  'white-space',
  'width',
  'max-width',
  'min-width',
  'height',
  'max-height',
  'min-height',
  'display',
  'float',
  'clear',
  'box-shadow',
  'opacity',
  'gap',
  'flex',
  'flex-wrap',
  'flex-direction',
  'justify-content',
  'align-items',
  'grid-template-columns',
  'list-style',
  'list-style-type',
  'overflow',
  'overflow-x',
  'table-layout',
  'word-break',
];

const allowedStyles = Object.fromEntries(
  allowedCssProperties.map((property) => [property, [SAFE_CSS]]),
);

/**
 * Lista blanca de clases: solo las de MediaWiki y HikariRO, para que el contenido
 * no pueda activar utilidades de la app (p. ej. `fixed` o `hidden` de Tailwind).
 */
const allowedClasses = [
  'mw-*',
  'hro-*',
  'hro2-*',
  'wikitable',
  'sortable',
  'image',
  'center',
  'floatleft',
  'floatright',
  'floatnone',
  'thumb',
  'thumbinner',
  'thumbimage',
  'thumbcaption',
  'tright',
  'tleft',
  'external',
  'text',
  'gallery',
  'gallerybox',
  'gallerytext',
  'reference',
  'references',
  'noprint',
  'plainlinks',
  'toc',
  'tocnumber',
  'toctext',
];

export function sanitizeWikiHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'div',
      'span',
      'a',
      'b',
      'i',
      'strong',
      'em',
      'u',
      's',
      'del',
      'ins',
      'sup',
      'sub',
      'br',
      'hr',
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'caption',
      'colgroup',
      'col',
      'img',
      'figure',
      'figcaption',
      'blockquote',
      'pre',
      'code',
      'kbd',
      'small',
      'big',
      'center',
      'abbr',
      'mark',
      'details',
      'summary',
    ],
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'title', 'lang', 'dir'],
      a: ['href', 'target', 'rel', 'data-wiki'],
      img: ['src', 'srcset', 'alt', 'width', 'height', 'loading', 'decoding'],
      td: ['colspan', 'rowspan', 'align', 'valign'],
      th: ['colspan', 'rowspan', 'scope', 'align', 'valign'],
      col: ['span'],
      ol: ['start', 'type'],
    },
    allowedClasses: { '*': allowedClasses },
    allowedStyles: { '*': allowedStyles },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === '_blank') attribs.rel = 'noopener noreferrer nofollow';
        return { tagName, attribs };
      },
    },
  });
}

/** Elimina las etiquetas HTML de un fragmento (p. ej. displaytitle o títulos de sección). */
export function toPlainText(html: string): string {
  return cheerio.load(`<div>${html}</div>`, null, false)('div').text().replace(/\s+/g, ' ').trim();
}
