import type { WikiPage } from '@hikari-hub/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BookX, CornerDownRight, ListTree, Tag } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { WikiBreadcrumbs } from './WikiBreadcrumbs';
import { WikiContent } from './WikiContent';
import { CategoryLink } from './WikiLinks';
import { wikiPageQuery } from './wiki-query';

function TableOfContents({ page, className }: { page: WikiPage; className?: string }) {
  if (page.sections.length < 2) return null;
  return (
    <nav aria-label="Contenido del artículo" className={className}>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">
        <ListTree aria-hidden="true" className="size-4" />
        Contenido
      </p>
      <ol className="flex flex-col gap-0.5 text-sm">
        {page.sections.map((section) => (
          <li key={section.anchor} className={cn(section.level > 2 && 'pl-3')}>
            <a
              href={`#${section.anchor}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(section.anchor)?.scrollIntoView({ behavior: 'smooth' });
                history.replaceState(null, '', `#${section.anchor}`);
              }}
              className={cn(
                'block rounded-md px-2 py-1 text-ink-muted transition hover:bg-white/5 hover:text-ink',
                section.level > 2 && 'text-[0.82rem] text-ink-faint',
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function WikiArticlePage({ title }: { title: string }) {
  const { data: page, error, isPending, refetch } = useQuery(wikiPageQuery(title));

  if (isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando artículo" className="flex flex-col gap-4">
        <WikiBreadcrumbs items={[title]} />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }

  if (error && !page) {
    const missing = error instanceof ApiError && error.code === 'NOT_FOUND';
    return (
      <div className="flex flex-col gap-6">
        <WikiBreadcrumbs items={[title]} />
        {missing ? (
          <EmptyState icon={BookX} title={`«${title}» no existe en la wiki`}>
            Prueba a buscarlo o vuelve a la portada de la wiki.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const [mainCategory] = page.categories;

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <WikiBreadcrumbs
        items={[
          ...(mainCategory
            ? [<CategoryLink key="cat" name={mainCategory} className="hover:text-ink" />]
            : []),
          page.title,
        ]}
      />

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {page.title}
        </h1>
        {page.redirectedFrom && (
          <p className="flex items-center gap-1.5 text-sm text-ink-faint">
            <CornerDownRight aria-hidden="true" className="size-4" />
            Redirigido desde «{page.redirectedFrom}»
          </p>
        )}
        {page.categories.length > 0 && (
          <ul aria-label="Categorías" className="flex flex-wrap gap-1.5">
            {page.categories.map((category) => (
              <li key={category}>
                <CategoryLink
                  name={category}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-ink-muted transition hover:border-white/20 hover:text-gold-200"
                >
                  <Tag aria-hidden="true" className="size-3" />
                  {category}
                </CategoryLink>
              </li>
            ))}
          </ul>
        )}
      </header>

      <details className="rounded-card border border-white/8 bg-night-850/70 p-4 xl:hidden">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted">
          Índice del artículo
        </summary>
        <TableOfContents page={page} className="mt-3" />
      </details>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <article className="min-w-0">
          <WikiContent html={page.html} />
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-faint">
            <span>
              Contenido de la HikariRO Wiki{page.revisionId ? ` · revisión ${page.revisionId}` : ''}
            </span>
            <a
              href={page.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-ink"
            >
              Ver en la wiki original <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          </footer>
        </article>
        <aside className="hidden xl:block">
          <TableOfContents
            page={page}
            className="sticky top-8 max-h-[calc(100dvh-4rem)] overflow-y-auto"
          />
        </aside>
      </div>
    </div>
  );
}
