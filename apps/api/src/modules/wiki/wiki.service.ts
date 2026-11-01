import {
  wikiNoticeSchema,
  type WikiCategoriesResponse,
  type WikiCategoryResponse,
  type WikiIndexResponse,
  type WikiPage,
  type WikiSearchResponse,
} from '@hikari-hub/shared';
import { z } from 'zod';
import { AppError } from '../../lib/app-error.js';
import { sanitizeWikiHtml } from './wiki-html.js';

const wikiDataSchema = z.object({
  groups: z.array(z.object({ name: z.string(), pages: z.array(z.string()) })),
  pages: z.array(
    z.object({
      title: z.string(),
      group: z.string().nullable(),
      html: z.string(),
      sections: z.array(z.object({ level: z.number(), title: z.string(), anchor: z.string() })),
      notice: wikiNoticeSchema.nullable(),
      text: z.string(),
    }),
  ),
});

export type WikiData = z.infer<typeof wikiDataSchema>;

/** Minúsculas, sin tildes y con "_" como espacio: "Guía_de_oficios" == "guia de oficios". */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();
}

const SNIPPET_RADIUS = 90;
const MAX_RESULTS = 20;
const MAX_SUGGESTIONS = 8;

interface Entry {
  title: string;
  key: string;
  group: string | null;
  html: string;
  sections: WikiData['pages'][number]['sections'];
  notice: WikiData['pages'][number]['notice'];
  text: string;
  textKey: string;
}

/**
 * La wiki de HikariRO, servida desde una copia local. El contenido (`pages.json`) no va dentro de la app:
 * lo descarga `WikiStore` de GitHub la primera vez y lo entrega con `load()`. No hace peticiones a HikariRO.
 */
export class WikiService {
  private entries: Entry[] = [];
  private byKey = new Map<string, Entry>();
  private groups: WikiData['groups'] = [];
  private loaded = false;

  constructor(
    private readonly origin: string,
    data?: unknown,
  ) {
    if (data !== undefined) this.load(data);
  }

  get ready(): boolean {
    return this.loaded;
  }

  /** Sustituye el contenido; lanza si el formato no es el esperado y deja el anterior intacto. */
  load(data: unknown): void {
    const parsed = wikiDataSchema.parse(data);
    const entries = parsed.pages.map((page) => ({
      ...page,
      key: normalize(page.title),
      html: sanitizeWikiHtml(page.html),
      textKey: normalize(page.text),
    }));
    this.groups = parsed.groups;
    this.entries = entries;
    this.byKey = new Map(entries.map((entry) => [entry.key, entry]));
    this.loaded = true;
  }

  private ensureReady(): void {
    if (!this.loaded) throw new AppError('WIKI_UNAVAILABLE');
  }

  async page(title: string): Promise<WikiPage> {
    this.ensureReady();
    const entry = this.byKey.get(normalize(title));
    if (!entry)
      throw new AppError('NOT_FOUND', { publicMessage: 'Esta página no existe en la wiki.' });
    return {
      title: entry.title,
      redirectedFrom: null,
      revisionId: null,
      html: entry.html,
      sections: entry.sections,
      categories: entry.group ? [entry.group] : [],
      notice: entry.notice,
      sourceUrl: `${this.origin}/wiki/index.php?search=${encodeURIComponent(entry.title)}`,
    };
  }

  async search(query: string): Promise<WikiSearchResponse> {
    this.ensureReady();
    const terms = normalize(query).split(' ').filter(Boolean);
    const phrase = terms.join(' ');
    const scored = this.entries
      .map((entry) => {
        let score = 0;
        if (entry.key === phrase) score += 200;
        else if (entry.key.startsWith(phrase)) score += 120;
        else if (entry.key.includes(phrase)) score += 80;
        if (terms.every((term) => entry.key.includes(term))) score += 40;
        const body = terms.reduce((sum, term) => sum + countOccurrences(entry.textKey, term), 0);
        if (terms.every((term) => entry.textKey.includes(term))) score += Math.min(body, 30);
        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'es'));

    return {
      query,
      titles: this.entries
        .filter((entry) => entry.key.startsWith(phrase))
        .slice(0, MAX_SUGGESTIONS)
        .map((entry) => entry.title),
      results: scored.slice(0, MAX_RESULTS).map(({ entry }) => ({
        title: entry.title,
        snippet: snippetFor(entry.text, terms),
        updatedAt: null,
        words: entry.text ? entry.text.split(' ').length : null,
      })),
      total: scored.length,
    };
  }

  async allCategories(): Promise<WikiCategoriesResponse> {
    this.ensureReady();
    return {
      categories: this.groups.map((group) => ({ name: group.name, pages: group.pages.length })),
    };
  }

  async category(name: string): Promise<WikiCategoryResponse> {
    this.ensureReady();
    const group = this.groups.find((item) => normalize(item.name) === normalize(name));
    if (!group) throw new AppError('NOT_FOUND', { publicMessage: 'Esta categoría no existe.' });
    return { name: group.name, pages: group.pages, subcategories: [] };
  }

  async index(): Promise<WikiIndexResponse> {
    this.ensureReady();
    return { pages: this.entries.map((entry) => entry.title) };
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    count += 1;
  }
  return count;
}

/**
 * Fragmento del texto alrededor de la primera coincidencia, con los términos marcados.
 * La búsqueda ignora tildes: se localiza en el texto normalizado (misma longitud que el original
 * al descomponer solo letras acentuadas) y se marca sobre el texto original.
 */
function snippetFor(
  text: string,
  terms: string[],
): WikiSearchResponse['results'][number]['snippet'] {
  if (!text) return [];
  const flat = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  // Si la normalización cambió la longitud, no se puede alinear: se devuelve el inicio sin marcas.
  if (flat.length !== text.length)
    return [{ text: text.slice(0, SNIPPET_RADIUS * 2), match: false }];

  const hits = terms.map((term) => flat.indexOf(term)).filter((at) => at !== -1);
  const first = hits.length ? Math.min(...hits) : 0;
  const start = Math.max(0, first - SNIPPET_RADIUS);
  const end = Math.min(text.length, first + SNIPPET_RADIUS);
  const pattern = terms.length
    ? new RegExp(
        `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
        'g',
      )
    : null;

  const parts: WikiSearchResponse['results'][number]['snippet'] = [];
  const slice = flat.slice(start, end);
  const original = text.slice(start, end);
  let cursor = 0;
  if (pattern) {
    for (const match of slice.matchAll(pattern)) {
      const at = match.index ?? 0;
      if (at > cursor) parts.push({ text: original.slice(cursor, at), match: false });
      parts.push({ text: original.slice(at, at + match[0].length), match: true });
      cursor = at + match[0].length;
    }
  }
  if (cursor < original.length) parts.push({ text: original.slice(cursor), match: false });
  const head = parts[0];
  if (start > 0 && head) parts[0] = { ...head, text: `…${head.text}` };
  const last = parts[parts.length - 1];
  if (end < text.length && last) parts[parts.length - 1] = { ...last, text: `${last.text}…` };
  return parts;
}
