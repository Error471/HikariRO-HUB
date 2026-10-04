import { WIKI_MAIN_PAGE } from '@hikari-hub/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, ChevronRight, Compass, FolderOpen } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { modules } from '@/app/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArticleLink, CategoryLink } from './WikiLinks';
import { WikiSearchBox } from './WikiSearchBox';
import { wikiCategoriesQuery, wikiCategoryQuery, wikiIndexQuery } from './wiki-query';

const FEATURED_CATEGORY = 'Guías';

function groupByLetter(pages: string[]) {
  const groups = new Map<string, string[]>();
  for (const title of [...pages].sort((a, b) => a.localeCompare(b, 'es'))) {
    const first = title.normalize('NFD').charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : '#';
    groups.set(letter, [...(groups.get(letter) ?? []), title]);
  }
  return [...groups.entries()];
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BookOpen;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-card border border-white/7 bg-night-850/80 p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
        <Icon aria-hidden="true" className="size-5 text-gold-300" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function WikiHomePage() {
  const categories = useQuery(wikiCategoriesQuery);
  const guides = useQuery(wikiCategoryQuery(FEATURED_CATEGORY));
  const index = useQuery(wikiIndexQuery);
  const letters = useMemo(() => groupByLetter(index.data?.pages ?? []), [index.data]);

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <PageHeader
        title="Wiki"
        description="Guías, sistemas e instancias de la wiki oficial, sin salir de Hikari Hub."
        actions={
          <a
            href={modules.wiki.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-white/20 hover:text-ink"
          >
            Wiki original <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        }
      />
      <WikiSearchBox />

      <ArticleLink
        title={WIKI_MAIN_PAGE}
        className="panel group flex items-center gap-4 rounded-card p-5 transition"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold-400/12 text-gold-300">
          <Compass aria-hidden="true" className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-semibold tracking-tight group-hover:text-gold-200">
            Página principal
          </span>
          <span className="block text-sm text-ink-muted">
            Empieza tu aventura: comandos, sistema VIP, sistemas exclusivos e información del
            servidor.
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 text-gold-300 transition group-hover:translate-x-0.5"
        />
      </ArticleLink>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title={FEATURED_CATEGORY} icon={BookOpen}>
          {guides.isPending ? (
            <Skeleton className="h-48" />
          ) : guides.error && !guides.data ? (
            <ErrorState error={guides.error} onRetry={() => void guides.refetch()} />
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {guides.data.pages.map((title) => (
                <li key={title}>
                  <ArticleLink
                    title={title}
                    className="block truncate rounded-lg px-2 py-1.5 text-sm text-ink-muted transition hover:bg-white/5 hover:text-ink"
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Categorías" icon={FolderOpen}>
          {categories.isPending ? (
            <Skeleton className="h-48" />
          ) : categories.error && !categories.data ? (
            <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {categories.data.categories.map((category) => (
                <li key={category.name}>
                  <CategoryLink
                    name={category.name}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-sm text-ink-muted transition hover:border-white/20 hover:text-gold-200"
                  >
                    {category.name}
                    <span className="text-xs tabular-nums text-ink-faint">{category.pages}</span>
                  </CategoryLink>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Todas las páginas" icon={BookOpen}>
        {index.isPending ? (
          <Skeleton className="h-40" />
        ) : index.error && !index.data ? (
          <ErrorState error={index.error} onRetry={() => void index.refetch()} />
        ) : (
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
            {letters.map(([letter, titles]) => (
              <section key={letter} className="mb-4 break-inside-avoid">
                <h3 className="mb-1 font-display text-sm font-semibold text-gold-300">{letter}</h3>
                <ul>
                  {titles.map((title) => (
                    <li key={title}>
                      <ArticleLink
                        title={title}
                        className="block truncate py-0.5 text-sm text-ink-muted hover:text-ink"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
