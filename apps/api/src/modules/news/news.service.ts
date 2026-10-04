import {
  newsSections,
  type NewsListResponse,
  type NewsPost,
  type NewsSection,
} from '@hikari-hub/shared';
import { z } from 'zod';
import type { HikariClient } from '../../hikari/hikari-client.js';
import { parseUpstreamJson } from '../../hikari/upstream-json.js';
import { TtlCache } from '../../lib/ttl-cache.js';
import { bodyWithoutTitle, extractTitleAndSummary } from './news-text.js';

/** Formato de `api.hikariro.com/discord/feed.php` observado el 03/10/2026. */
const upstreamSchema = z.object({
  updated_at: z.string().nullish(),
  posts: z.array(
    z.object({
      id: z.coerce.string(),
      section: z.string().nullish(),
      author: z.string().nullish(),
      content: z.string().nullish(),
      created_at: z.string(),
      image: z.string().nullish(),
      url: z.string().nullish(),
    }),
  ),
});
type UpstreamPost = z.infer<typeof upstreamSchema>['posts'][number];

const CACHE_TTL_MS = 60_000;
const IMAGE_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const SOURCE_HOSTS = new Set(['discord.com']);

function allowedUrl(value: string | null | undefined, hosts: Set<string>): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function toSection(value: string | null | undefined): NewsSection {
  return (newsSections as readonly string[]).includes(value ?? '')
    ? (value as NewsSection)
    : 'otros';
}

function toPost(post: UpstreamPost): NewsPost {
  const author = post.author?.trim() || 'Equipo HikariRO';
  const content = post.content ?? '';
  return {
    id: post.id,
    section: toSection(post.section),
    author,
    ...extractTitleAndSummary(content, author),
    content,
    body: bodyWithoutTitle(content),
    publishedAt: post.created_at,
    imageUrl: allowedUrl(post.image, IMAGE_HOSTS),
    sourceUrl: allowedUrl(post.url, SOURCE_HOSTS),
  };
}

export class NewsService {
  private readonly cache = new TtlCache<NewsListResponse>(CACHE_TTL_MS, 1);

  constructor(
    private readonly client: HikariClient,
    private readonly feedPath: string,
  ) {}

  list(): Promise<NewsListResponse> {
    return this.cache.get('feed', async () => {
      const response = await this.client.get(this.feedPath);
      const data = parseUpstreamJson(response, upstreamSchema);
      return { updatedAt: data.updated_at ?? null, posts: data.posts.map(toPost) };
    });
  }
}
