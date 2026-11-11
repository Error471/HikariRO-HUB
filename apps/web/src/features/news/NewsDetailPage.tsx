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
            <h1 className="mt-4 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              {post.title}
            </h1>
          </header>
          <NewsImage
            src={post.imageUrl}
            className="w-full rounded-card border border-white/9 bg-night-950 object-contain shadow-[0_28px_56px_-30px_rgb(0_0_0/0.85)]"
          />
          {(post.body || !post.content) && (
            <div className="rounded-card surface p-5 sm:p-7">
              <DiscordMarkdown content={post.body} />
            </div>
          )}
          {post.sourceUrl && (
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4.5 text-sm font-medium text-ink-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-colors duration-200 hover:border-white/18 hover:bg-white/[0.07] hover:text-ink self-start"
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
