import type { NewsPost } from '@hrc/shared';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { formatLongDate, formatRelative } from '@/lib/format';
import { SectionBadge } from './SectionBadge';

export function NewsImage({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function NewsCard({ post }: { post: NewsPost }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-white/7 bg-night-850/80 transition duration-300 hover:-translate-y-0.5 hover:border-gold-400/35">
      <NewsImage
        src={post.imageUrl}
        className="aspect-[16/9] w-full border-b border-white/6 bg-night-950 object-cover"
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-faint">
          <SectionBadge section={post.section} />
          <time dateTime={post.publishedAt} title={formatLongDate(post.publishedAt)}>
            {formatRelative(post.publishedAt)}
          </time>
        </div>
        <h2 className="mt-3 text-lg leading-snug font-semibold text-balance text-ink">
          <Link
            to="/noticias/$postId"
            params={{ postId: post.id }}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {post.title}
          </Link>
        </h2>
        {post.summary && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{post.summary}</p>
        )}
        <p className="mt-auto flex items-center justify-between pt-4 text-xs text-ink-faint">
          <span className="truncate">{post.author}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-gold-300">
            Leer más
            <ChevronRight
              aria-hidden="true"
              className="size-4 transition group-hover:translate-x-0.5"
            />
          </span>
        </p>
      </div>
    </article>
  );
}
