import type { CardSort, CardStatus } from '@hikari-hub/shared';
import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { modules } from '@/app/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { CardTile } from './CardTile';
import { cardAlbumQuery, type CardAlbumParams } from './album-query';

interface CardAlbumPageProps {
  params: CardAlbumParams;
  onParamsChange: (params: Partial<CardAlbumParams>) => void;
}

function CardGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando cartas"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {Array.from({ length: 10 }, (_, index) => (
        <Skeleton key={index} className="aspect-[3/4.4] rounded-card" />
      ))}
    </div>
  );
}

export function CardAlbumPage({ params, onParamsChange }: CardAlbumPageProps) {
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useQuery(
    cardAlbumQuery(params),
  );
  const [search, setSearch] = useState(params.q);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const topRef = useRef<HTMLDivElement>(null);

  const syncedQuery = useRef(params.q);

  // Atrás/adelante del navegador: la URL manda sobre el campo de búsqueda.
  useEffect(() => {
    if (params.q === syncedQuery.current) return;
    syncedQuery.current = params.q;
    setSearch(params.q);
  }, [params.q]);

  useEffect(() => {
    const settled = debouncedSearch === search.trim();
    if (!settled || debouncedSearch === syncedQuery.current) return;
    syncedQuery.current = debouncedSearch;
    onParamsChange({ q: debouncedSearch, page: 1 });
  }, [debouncedSearch, search, onParamsChange]);

  const changePage = (page: number) => {
    onParamsChange({ page });
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const progress = data?.progress;
  const statusOptions: FilterOption<CardStatus>[] = [
    { value: 'all', label: 'Todas', count: progress?.total },
    { value: 'found', label: 'Obtenidas', count: progress?.obtained },
    {
      value: 'missing',
      label: 'Faltantes',
      count: progress ? progress.total - progress.obtained : undefined,
    },
  ];
  const sortOptions: FilterOption<CardSort>[] = [
    { value: 'id', label: 'Por ID' },
    { value: 'name', label: 'Por nombre' },
  ];
  const firstShown = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastShown = data ? Math.min(data.page * data.pageSize, data.results) : 0;

  return (
    <div ref={topRef} className="flex scroll-mt-24 flex-col gap-6 animate-rise">
      <PageHeader
        eyebrow="Álbumes"
        title="Cartas"
        description="Tu colección de cartas en HikariRO."
      />

      <section className="panel rounded-card p-5 sm:p-6">
        {progress ? (
          <ProgressMeter
            label="Progreso de la colección"
            obtained={progress.obtained}
            total={progress.total}
            unit="cartas"
          />
        ) : (
          <Skeleton className="h-16" />
        )}
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Filtrar por estado"
          options={statusOptions}
          value={params.status}
          onChange={(status) => onParamsChange({ status, page: 1 })}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <FilterTabs
            label="Ordenar"
            options={sortOptions}
            value={params.sort}
            onChange={(sort) => onParamsChange({ sort, page: 1 })}
          />
          <SearchInput
            label="Buscar carta"
            placeholder="Buscar por nombre o ID…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:w-72"
          />
        </div>
      </div>

      {isPending ? (
        <CardGridSkeleton />
      ) : error && !data ? (
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackUrl={modules.cards.sourceUrl}
        />
      ) : data.cards.length === 0 ? (
        <EmptyState icon={Layers} title="No hay cartas que coincidan">
          {params.q ? 'Prueba con otro nombre o ID.' : 'Cambia el filtro para ver más cartas.'}
        </EmptyState>
      ) : (
        <>
          <p className="text-xs text-ink-faint tabular-nums" aria-live="polite">
            Mostrando {formatCount(firstShown)}–{formatCount(lastShown)} de{' '}
            {formatCount(data.results)}
          </p>
          <div
            aria-busy={isFetching || undefined}
            className={cn(
              'grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
              isPlaceholderData && 'opacity-60',
            )}
          >
            {data.cards.map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={changePage} />
        </>
      )}
    </div>
  );
}
