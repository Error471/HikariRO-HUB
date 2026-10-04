import type { NewsSection } from '@hikari-hub/shared';
import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { modules } from '@/app/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatLongDate } from '@/lib/format';
import { NewsCard } from './NewsCard';
import { newsQuery, sectionMeta } from './news-query';

export type NewsFilter = 'all' | Exclude<NewsSection, 'otros'>;

interface NewsPageProps {
  section: NewsFilter;
  onSectionChange: (section: NewsFilter) => void;
}

export function NewsPage({ section, onSectionChange }: NewsPageProps) {
  const { data, error, isPending, refetch } = useQuery(newsQuery);
  const posts = data?.posts ?? [];
  const visible = section === 'all' ? posts : posts.filter((post) => post.section === section);

  const options: FilterOption<NewsFilter>[] = [
    { value: 'all', label: 'Todas', count: posts.length },
    ...(['noticias', 'eventos', 'changelog'] as const).map((value) => ({
      value,
      label: sectionMeta[value].label,
      count: posts.filter((post) => post.section === value).length,
    })),
  ];

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <PageHeader
        eyebrow="Comunidad"
        title="Noticias"
        description={
          data?.updatedAt
            ? `Publicaciones del Discord oficial · actualizado ${formatLongDate(data.updatedAt)}`
            : 'Publicaciones del Discord oficial de HikariRO.'
        }
      />
      <FilterTabs
        label="Filtrar por sección"
        options={options}
        value={section}
        onChange={onSectionChange}
      />

      {isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando noticias"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-80 rounded-card" />
          ))}
        </div>
      ) : error && !data ? (
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackUrl={modules.news.sourceUrl}
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={Newspaper} title="No hay publicaciones en esta sección" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((post) => (
            <NewsCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
