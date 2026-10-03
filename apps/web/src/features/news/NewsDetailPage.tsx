import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ChevronLeft, Newspaper } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatLongDate } from '@/lib/format';
import { DiscordMarkdown } from './DiscordMarkdown';
import { NewsImage } from './NewsCard';
import { newsQuery } from './news-query';
import { SectionBadge } from './SectionBadge';

export function NewsDetailPage({ postId }: { postId: string }) {
  const { data, error, isPending, refetch } = useQuery(newsQuery);
  const post = data?.posts.find((candidate) => candidate.id === postId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-rise">
      <nav aria-label="Ruta de navegación">
        <Link
          to="/noticias"
          className="inline-flex min-h-10 items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Noticias
        </Link>
      </nav>

      {isPending ? (
        <div aria-busy="true" aria-label="Cargando noticia" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !post ? (
        <EmptyState icon={Newspaper} title="Esta publicación ya no está disponible">
          El feed de HikariRO solo incluye las publicaciones más recientes.
        </EmptyState>
      ) : (
        <article className="flex flex-col gap-6">
          <header>
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-faint">
              <SectionBadge section={post.section} />
              <time dateTime={post.publishedAt}>{formatLongDate(post.publishedAt)}</time>
              <span>· {post.author}</span>
            </div>
            <h1 className="mt-4 font-display text-2xl leading-tight font-bold tracking-wide text-balance sm:text-3xl">
              {post.title}
            </h1>
          </header>
          <NewsImage
            src={post.imageUrl}
            className="w-full rounded-card border border-white/8 bg-night-950 object-contain"
          />
          {(post.body || !post.content) && (
            <div className="rounded-card border border-white/7 bg-night-850/70 p-5 sm:p-7">
              <DiscordMarkdown content={post.body} />
            </div>
          )}
          {post.sourceUrl && (
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-gold-400/40 hover:text-ink"
            >
              Ver en Discord
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          )}
        </article>
      )}
    </div>
  );
}
