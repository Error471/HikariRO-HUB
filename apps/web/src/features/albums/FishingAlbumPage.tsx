import { useQuery } from '@tanstack/react-query';
import { Fish } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { modules } from '@/app/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { normalizeText } from '@/features/markets/market-query';
import { FishTile } from './FishTile';
import { fishingAlbumQuery } from './album-query';

export type FishFilter = 'all' | 'caught' | 'pending';

interface FishingAlbumPageProps {
  filter: FishFilter;
  onFilterChange: (filter: FishFilter) => void;
}

export function FishingAlbumPage({ filter, onFilterChange }: FishingAlbumPageProps) {
  const { data, error, isPending, refetch } = useQuery(fishingAlbumQuery);
  const [search, setSearch] = useState('');
  const needle = normalizeText(useDeferredValue(search));

  const fish = data?.fish ?? [];
  const caught = fish.filter((entry) => entry.discovered).length;
  const visible = fish.filter((entry) => {
    if (filter === 'caught' && !entry.discovered) return false;
    if (filter === 'pending' && entry.discovered) return false;
    if (needle) return entry.discovered && normalizeText(entry.name).includes(needle);
    return true;
  });

  const options: FilterOption<FishFilter>[] = [
    { value: 'all', label: 'Todos', count: fish.length },
    { value: 'caught', label: 'Capturados', count: caught },
    { value: 'pending', label: 'Pendientes', count: fish.length - caught },
  ];

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <PageHeader
        eyebrow="Álbumes"
        title="Pesca"
        description="Especies descubiertas, récords y capturas. El álbum se comparte entre los personajes de tu cuenta."
      />

      <section className="panel rounded-card p-5 sm:p-6">
        {data ? (
          <ProgressMeter
            label="Especies descubiertas"
            obtained={data.progress.obtained}
            total={data.progress.total}
            unit="especies"
          />
        ) : (
          <Skeleton className="h-16" />
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          label="Filtrar especies"
          options={options}
          value={filter}
          onChange={onFilterChange}
        />
        <SearchInput
          label="Buscar especie"
          placeholder="Buscar especie descubierta…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:w-72"
        />
      </div>

      {isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando álbum"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-52 rounded-card" />
          ))}
        </div>
      ) : error && !data ? (
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackUrl={modules.fishing.sourceUrl}
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={Fish} title="No hay especies que coincidan">
          {filter === 'caught' && !needle
            ? 'Todavía no has descubierto ninguna especie.'
            : 'Prueba con otro filtro.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((entry, index) => (
            <FishTile key={entry.discovered ? `f-${entry.name}` : `l-${index}`} fish={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
