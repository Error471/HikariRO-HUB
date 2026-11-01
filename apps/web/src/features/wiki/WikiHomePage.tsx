import { WIKI_MAIN_PAGE } from '@hikari-hub/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight, Compass, FileText } from 'lucide-react';
import { modules } from '@/app/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArticleLink, CategoryLink } from './WikiLinks';
import { WikiSearchBox } from './WikiSearchBox';
import { wikiCategoriesQuery, wikiCategoryQuery } from './wiki-query';

function CategoryPanel({ name, pages }: { name: string; pages: number }) {
  const { data, isPending } = useQuery(wikiCategoryQuery(name));
  return (
    <section className="min-w-0 rounded-card border border-white/7 bg-night-850/80 p-5">
      <h2 className="mb-3 flex items-baseline justify-between gap-3 font-display text-2xl font-semibold tracking-tight">
        <CategoryLink name={name} className="transition hover:text-gold-200" />
        <span className="text-xs font-normal tabular-nums text-ink-faint">{pages}</span>
      </h2>
      {isPending ? (
        <Skeleton className="h-20" />
      ) : (
        <ul className="flex flex-col">
          {data?.pages.map((title) => (
            <li key={title}>
              <ArticleLink
                title={title}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-muted transition hover:bg-white/5 hover:text-ink"
              >
                <FileText aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
                <span className="truncate">{title}</span>
              </ArticleLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WikiHomePage() {
  const categories = useQuery(wikiCategoriesQuery);

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <PageHeader
        title="Wiki"
        description="Guías, sistemas e instancias de HikariRO. Está guardada en la propia app: funciona sin conexión."
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
          <span className="block font-display text-2xl font-semibold tracking-tight group-hover:text-gold-200">
            Página principal
          </span>
          <span className="block text-sm text-ink-muted">
            Empieza tu aventura: sistemas exclusivos, NPC y utilidades, e información del servidor.
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 text-gold-300 transition group-hover:translate-x-0.5"
        />
      </ArticleLink>

      {categories.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-card" />
          ))}
        </div>
      ) : categories.error && !categories.data ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.data.categories.map((category) => (
            <CategoryPanel key={category.name} name={category.name} pages={category.pages} />
          ))}
        </div>
      )}
    </div>
  );
}
