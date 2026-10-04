import { useQuery } from '@tanstack/react-query';
import { FileSearch, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatLongDate } from '@/lib/format';
import { WikiBreadcrumbs } from './WikiBreadcrumbs';
import { ArticleLink } from './WikiLinks';
import { WikiSearchBox } from './WikiSearchBox';
import { wikiSearchQuery } from './wiki-query';

export function WikiSearchPage({ query }: { query: string }) {
  const trimmed = query.trim();
  const { data, error, isFetching, isPlaceholderData, refetch } = useQuery(
    wikiSearchQuery(trimmed),
  );
  const ready = trimmed.length >= 2;

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <WikiBreadcrumbs items={['Buscar']} />
      <h1 className="font-display text-3xl font-semibold tracking-tight">Buscar en la wiki</h1>
      <WikiSearchBox initialQuery={trimmed} autoFocus />

      {!ready ? (
        <EmptyState icon={Search} title="¿Qué quieres consultar?">
          Escribe al menos 2 letras: un sistema, una instancia, un objeto…
        </EmptyState>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <div aria-busy="true" aria-label="Buscando" className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
        </div>
      ) : data.results.length === 0 && data.titles.length === 0 && !isPlaceholderData ? (
        <EmptyState icon={FileSearch} title={`Sin resultados para «${data.query}»`}>
          Prueba con otras palabras o revisa la ortografía.
        </EmptyState>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            isFetching && isPlaceholderData && 'opacity-60',
          )}
        >
          {data.titles.length > 0 && (
            <section aria-labelledby="wiki-titles">
              <h2
                id="wiki-titles"
                className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint"
              >
                Páginas
              </h2>
              <ul className="flex flex-wrap gap-2">
                {data.titles.map((title) => (
                  <li key={title}>
                    <ArticleLink
                      title={title}
                      className="inline-flex min-h-9 items-center rounded-full border border-gold-400/30 bg-gold-400/8 px-3 text-sm text-gold-200 hover:bg-gold-400/15"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.results.length > 0 && (
            <section aria-labelledby="wiki-results">
              <h2
                id="wiki-results"
                className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint"
              >
                En el contenido ({data.total})
              </h2>
              <ul className="flex flex-col gap-2">
                {data.results.map((result) => (
                  <li key={result.title}>
                    <ArticleLink
                      title={result.title}
                      className="group block rounded-card border border-white/7 bg-night-850/80 p-4 transition hover:border-white/20"
                    >
                      <span className="block font-medium text-ink group-hover:text-gold-200">
                        {result.title}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-sm text-ink-muted">
                        {result.snippet.map((segment, index) =>
                          segment.match ? (
                            <mark
                              key={index}
                              className="rounded bg-gold-400/20 px-0.5 text-gold-200"
                            >
                              {segment.text}
                            </mark>
                          ) : (
                            <span key={index}>{segment.text}</span>
                          ),
                        )}
                      </span>
                      {result.updatedAt && (
                        <span className="mt-2 block text-xs text-ink-faint">
                          Actualizada el {formatLongDate(result.updatedAt)}
                        </span>
                      )}
                    </ArticleLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
