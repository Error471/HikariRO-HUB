import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Megaphone } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { SectionBadge } from '@/features/news/SectionBadge';
import { newsQuery } from '@/features/news/news-query';
import { errorMessage } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';

const VISIBLE = 3;

export function NewsWidget() {
  const { data, error, isPending } = useQuery(newsQuery);
  const posts = data?.posts.slice(0, VISIBLE) ?? [];

  return (
    <section
      aria-labelledby="widget-news"
      className="flex flex-col rounded-card border border-white/7 bg-night-850/80 p-5 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <h2
          id="widget-news"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
        >
          <Megaphone aria-hidden="true" className="size-5 text-gold-300" />
          Últimas noticias
        </h2>
        <Link
          to="/noticias"
          search={{ section: 'all' }}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-medium text-gold-300 hover:text-gold-200"
        >
          Ver todas
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <div className="mt-4 flex-1">
        {isPending ? (
          <div aria-busy="true" aria-label="Cargando noticias" className="flex flex-col gap-3">
            {Array.from({ length: VISIBLE }, (_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : error && !data ? (
          <p role="alert" className="text-sm text-ember-400">
            {errorMessage(error)}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/6">
            {posts.map((post) => (
              <li key={post.id} className="py-3 first:pt-0">
                <Link to="/noticias/$postId" params={{ postId: post.id }} className="group block">
                  <div className="flex items-center gap-2 text-xs text-ink-faint">
                    <SectionBadge section={post.section} />
                    <time dateTime={post.publishedAt}>{formatRelative(post.publishedAt)}</time>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium text-ink group-hover:text-gold-200">
                    {post.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
