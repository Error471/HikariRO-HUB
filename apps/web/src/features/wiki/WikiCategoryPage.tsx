import { useQuery } from '@tanstack/react-query';
import { FileText, FolderOpen, FolderX } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { WikiBreadcrumbs } from './WikiBreadcrumbs';
import { ArticleLink, CategoryLink } from './WikiLinks';
import { wikiCategoryQuery } from './wiki-query';

export function WikiCategoryPage({ name }: { name: string }) {
  const { data, error, isPending, refetch } = useQuery(wikiCategoryQuery(name));

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <WikiBreadcrumbs items={['Categorías', name]} />
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-400/80">
          Categoría
        </p>
        <h1 className="font-display text-3xl font-bold tracking-wide sm:text-4xl">{name}</h1>
      </header>

      {isPending ? (
        <Skeleton className="h-64 rounded-card" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.pages.length === 0 && data.subcategories.length === 0 ? (
        <EmptyState icon={FolderX} title="Esta categoría está vacía" />
      ) : (
        <>
          {data.subcategories.length > 0 && (
            <ul aria-label="Subcategorías" className="flex flex-wrap gap-2">
              {data.subcategories.map((subcategory) => (
                <li key={subcategory}>
                  <CategoryLink
                    name={subcategory}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-sm text-ink-muted hover:border-gold-400/40 hover:text-gold-200"
                  >
                    <FolderOpen aria-hidden="true" className="size-4" />
                    {subcategory}
                  </CategoryLink>
                </li>
              ))}
            </ul>
          )}
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.pages.map((title) => (
              <li key={title}>
                <ArticleLink
                  title={title}
                  className="flex min-h-14 items-center gap-3 rounded-card border border-white/7 bg-night-850/80 px-4 text-sm transition hover:border-gold-400/35 hover:text-gold-200"
                >
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-gold-300" />
                  <span className="truncate">{title}</span>
                </ArticleLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
