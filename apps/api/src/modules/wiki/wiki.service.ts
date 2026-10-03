import type {
  WikiCategoriesResponse,
  WikiCategoryResponse,
  WikiIndexResponse,
  WikiPage,
  WikiSearchResponse,
} from '@hrc/shared';
import { z } from 'zod';
import type { HikariClient } from '../../hikari/hikari-client.js';
import { parseUpstreamJson } from '../../hikari/upstream-json.js';
import { AppError } from '../../lib/app-error.js';
import { TtlCache } from '../../lib/ttl-cache.js';
import { rewriteWikiHtml, sanitizeWikiHtml, toPlainText } from './wiki-html.js';
import { parseSnippet } from './wiki-snippet.js';

const API_PATH = '/wiki/api.php';
const INDEX_PATH = '/wiki/index.php';
const PAGE_TTL_MS = 10 * 60_000;
const LIST_TTL_MS = 30 * 60_000;
const SEARCH_TTL_MS = 2 * 60_000;

/** Categorías de mantenimiento que MediaWiki crea automáticamente. */
const MAINTENANCE_CATEGORY = /^(Páginas con |Plantillas)/;

const apiError = z.object({ error: z.object({ code: z.string() }) });

const parseSchema = z.object({
  parse: z.object({
    title: z.string(),
    revid: z.number().optional(),
    text: z.string(),
    redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    sections: z.array(z.object({ level: z.coerce.number(), line: z.string(), anchor: z.string() })),
    categories: z.array(z.object({ category: z.string(), hidden: z.boolean().optional() })),
  }),
});

const searchSchema = z.object({
  query: z.object({
    searchinfo: z.object({ totalhits: z.number() }).optional(),
    search: z.array(
      z.object({
        title: z.string(),
        snippet: z.string().optional(),
        timestamp: z.string().optional(),
        wordcount: z.number().optional(),
      }),
    ),
    prefixsearch: z.array(z.object({ title: z.string() })).optional(),
  }),
});

const categoriesSchema = z.object({
  query: z.object({
    allcategories: z.array(
      z.object({
        category: z.string(),
        pages: z.number().optional(),
        hidden: z.boolean().optional(),
      }),
    ),
  }),
});

const membersSchema = z.object({
  query: z.object({
    categorymembers: z.array(z.object({ title: z.string(), ns: z.number() })),
  }),
});

const allPagesSchema = z.object({
  query: z.object({ allpages: z.array(z.object({ title: z.string() })) }),
});

const CATEGORY_NAMESPACE = 14;

/** Cliente de la API de MediaWiki 1.39 de HikariRO (solo lectura). */
export class WikiService {
  private readonly pages = new TtlCache<WikiPage>(PAGE_TTL_MS, 200);
  private readonly categoryList = new TtlCache<WikiCategoriesResponse>(LIST_TTL_MS, 1);
  private readonly pageIndex = new TtlCache<WikiIndexResponse>(LIST_TTL_MS, 1);
  private readonly categories = new TtlCache<WikiCategoryResponse>(LIST_TTL_MS, 100);
  private readonly searches = new TtlCache<WikiSearchResponse>(SEARCH_TTL_MS, 200);

  constructor(
    private readonly client: HikariClient,
    private readonly origin: string,
  ) {}

  page(title: string): Promise<WikiPage> {
    return this.pages.get(title, async () => {
      const data = await this.call(
        {
          action: 'parse',
          page: title,
          prop: 'text|sections|categories|revid',
          redirects: '1',
          disableeditsection: '1',
          disabletoc: '1',
        },
        parseSchema,
      );
      const { parse } = data;
      const html = sanitizeWikiHtml(
        rewriteWikiHtml(parse.text, { origin: this.origin, indexPath: INDEX_PATH }),
      );
      return {
        title: parse.title,
        redirectedFrom: parse.redirects?.[0]?.from ?? null,
        revisionId: parse.revid ?? null,
        html,
        sections: parse.sections
          .filter((section) => section.level <= 3)
          .map((section) => ({
            level: section.level,
            title: toPlainText(section.line),
            anchor: section.anchor,
          })),
        categories: parse.categories
          .filter((category) => !category.hidden)
          .map((category) => category.category.replace(/_/g, ' '))
          .filter((name) => !MAINTENANCE_CATEGORY.test(name)),
        sourceUrl: `${this.origin}${INDEX_PATH}?title=${encodeURIComponent(parse.title.replace(/ /g, '_'))}`,
      };
    });
  }

  search(query: string): Promise<WikiSearchResponse> {
    return this.searches.get(query.toLowerCase(), async () => {
      const data = await this.call(
        {
          action: 'query',
          list: 'search|prefixsearch',
          srsearch: query,
          srlimit: '20',
          srnamespace: '0',
          srprop: 'snippet|timestamp|wordcount',
          pssearch: query,
          pslimit: '8',
          psnamespace: '0',
        },
        searchSchema,
      );
      return {
        query,
        titles: (data.query.prefixsearch ?? []).map((page) => page.title),
        results: data.query.search.map((result) => ({
          title: result.title,
          snippet: parseSnippet(result.snippet ?? ''),
          updatedAt: result.timestamp ?? null,
          words: result.wordcount ?? null,
        })),
        total: data.query.searchinfo?.totalhits ?? data.query.search.length,
      };
    });
  }

  allCategories(): Promise<WikiCategoriesResponse> {
    return this.categoryList.get('categories', async () => {
      const data = await this.call(
        {
          action: 'query',
          list: 'allcategories',
          aclimit: '200',
          acprop: 'size|hidden',
          acmin: '1',
        },
        categoriesSchema,
      );
      return {
        categories: data.query.allcategories
          .filter((category) => !category.hidden && !MAINTENANCE_CATEGORY.test(category.category))
          .map((category) => ({ name: category.category, pages: category.pages ?? 0 }))
          .filter((category) => category.pages > 0),
      };
    });
  }

  category(name: string): Promise<WikiCategoryResponse> {
    return this.categories.get(name, async () => {
      const data = await this.call(
        {
          action: 'query',
          list: 'categorymembers',
          cmtitle: `Categoría:${name}`,
          cmlimit: '500',
          cmnamespace: `0|${CATEGORY_NAMESPACE}`,
          cmprop: 'title',
          cmsort: 'sortkey',
        },
        membersSchema,
      );
      const members = data.query.categorymembers;
      return {
        name,
        pages: members.filter((member) => member.ns === 0).map((member) => member.title),
        subcategories: members
          .filter((member) => member.ns === CATEGORY_NAMESPACE)
          .map((member) => member.title.replace(/^[^:]+:/, '')),
      };
    });
  }

  index(): Promise<WikiIndexResponse> {
    return this.pageIndex.get('index', async () => {
      const data = await this.call(
        {
          action: 'query',
          list: 'allpages',
          apnamespace: '0',
          aplimit: '500',
          apfilterredir: 'nonredirects',
        },
        allPagesSchema,
      );
      return { pages: data.query.allpages.map((page) => page.title) };
    });
  }

  private async call<TSchema extends z.ZodType>(
    params: Record<string, string>,
    schema: TSchema,
  ): Promise<z.infer<TSchema>> {
    const query = new URLSearchParams({ ...params, format: 'json', formatversion: '2' });
    const response = await this.client.get(`${API_PATH}?${query.toString()}`);
    const data = parseUpstreamJson(response, z.unknown());
    const error = apiError.safeParse(data);
    if (error.success) {
      if (['missingtitle', 'invalidtitle'].includes(error.data.error.code)) {
        throw new AppError('NOT_FOUND', { publicMessage: 'Esta página no existe en la wiki.' });
      }
      throw new AppError('UPSTREAM_CHANGED');
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new AppError('UPSTREAM_CHANGED', { cause: parsed.error });
    return parsed.data;
  }
}
