import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, FileText } from 'lucide-react';
import { modules } from '@/app/navigation';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArticleLink, CategoryLink } from './WikiLinks';
import { WikiSearchBox } from './WikiSearchBox';
import { wikiCategoriesQuery, wikiCategoryQuery } from './wiki-query';

function ArticleList({ titles }: { titles: string[] }) {
  return (
    <ul className="flex flex-col">
      {titles.map((title) => (
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
  );
}

/** Subcategoría dentro de la tarjeta de su categoría. */
function SubcategoryBlock({ name }: { name: string }) {
  const { data } = useQuery(wikiCategoryQuery(name));
  if (!data) return <Skeleton className="h-12" />;
  return (
    <div className="mt-3 border-t border-ink/10 pt-3">
      <h3 className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-300/90">
        <CategoryLink name={name} className="transition hover:text-gold-200">
          {name}
        </CategoryLink>
        <span className="font-normal tabular-nums text-ink-faint">{data.pages.length}</span>
      </h3>
      <ArticleList titles={data.pages} />
    </div>
  );
}

function CategoryPanel({ name, pages }: { name: string; pages: number }) {
  const { data, isPending } = useQuery(wikiCategoryQuery(name));
  return (
    <section className="min-w-0 rounded-card surface p-5">
      <h2 className="mb-3 flex items-baseline justify-between gap-3 font-display text-2xl font-semibold tracking-tight">
        <CategoryLink name={name} className="transition hover:text-gold-200" />
        <span className="text-xs font-normal tabular-nums text-ink-faint">{pages}</span>
      </h2>
      {isPending ? (
        <Skeleton className="h-20" />
      ) : (
        <>
          <ArticleList titles={data?.pages ?? []} />
          {data?.subcategories.map((subcategory) => (
            <SubcategoryBlock key={subcategory} name={subcategory} />
          ))}
        </>
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
        description="Los mismos artículos de la wiki online de HikariRO. Se guardan en tu PC: funciona sin conexión."
        actions={
          <a
            href={modules.wiki.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4.5 text-sm font-medium text-ink-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-colors duration-200 hover:border-white/18 hover:bg-white/[0.07] hover:text-ink"
          >
            Wiki online <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        }
      />
      <WikiSearchBox />

      {categories.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-card" />
          ))}
        </div>
      ) : categories.error && !categories.data ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.data.categories
            .filter((category) => category.parent === null)
            .map((category) => (
              <CategoryPanel
                key={category.name}
                name={category.name}
                pages={
                  category.pages +
                  categories.data.categories
                    .filter((child) => child.parent === category.name)
                    .reduce((sum, child) => sum + child.pages, 0)
                }
              />
            ))}
        </div>
      )}
    </div>
  );
}
