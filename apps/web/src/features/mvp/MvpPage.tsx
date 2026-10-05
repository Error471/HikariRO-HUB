import { Hourglass, RefreshCw, SearchX } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { modules } from '@/app/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';
import { NotificationsDialog } from '@/features/notifications/NotificationsDialog';
import { useMvpChannels } from '@/features/notifications/alerts';
import { useFavorites } from './favorites';
import { MvpCard } from './MvpCard';
import { useMvpList } from './mvp-query';
import { filterMvps, sortMvpViews, toMvpView, type MvpFilter } from './mvp-status';

interface MvpPageProps {
  initialQuery?: string;
  filter: MvpFilter;
  onFilterChange: (filter: MvpFilter) => void;
}

function MvpGridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando MVPs" className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-48 rounded-card" />
      ))}
    </div>
  );
}

export function MvpPage({ initialQuery = '', filter, onFilterChange }: MvpPageProps) {
  const { data, error, isPending, isFetching, refetch, offset } = useMvpList();
  const favorites = useFavorites();
  const alerts = useMvpChannels();
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const now = useNow(1000) + offset;

  const views = useMemo(
    () => sortMvpViews((data?.mvps ?? []).map((mvp) => toMvpView(mvp, now))),
    [data, now],
  );
  const visible = filterMvps(views, {
    filter,
    query: deferredQuery,
    favorites: favorites.values,
    alerted: alerts.alerted,
  });

  const count = (key: MvpFilter) =>
    filterMvps(views, {
      filter: key,
      query: '',
      favorites: favorites.values,
      alerted: alerts.alerted,
    }).length;
  const options: FilterOption<MvpFilter>[] = [
    { value: 'all', label: 'Todos', count: views.length },
    { value: 'window', label: 'Respawn aleatorio', count: count('window') },
    { value: 'cooldown', label: 'En espera', count: count('cooldown') },
    { value: 'ready', label: 'Disponibles', count: count('ready') },
    { value: 'favorites', label: 'Favoritos', count: favorites.values.size },
    { value: 'alerts', label: 'Con avisos', count: count('alerts') },
  ];

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <PageHeader
        title="MVP Timer"
        description="Respawns registrados en el servidor. Se actualiza cada 15 segundos."
        actions={
          <div className="flex flex-wrap gap-2">
            <NotificationsDialog />
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Actualizar ahora"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-white/20 hover:text-ink disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('size-4', isFetching && 'animate-spin')}
              />
              Actualizar
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <FilterTabs
          label="Filtrar por estado"
          options={options}
          value={filter}
          onChange={onFilterChange}
        />
        <SearchInput
          label="Buscar MVP o mapa"
          className="lg:w-72 lg:shrink-0"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar MVP o mapa…"
        />
      </div>

      {isPending ? (
        <MvpGridSkeleton />
      ) : error && !data ? (
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          fallbackUrl={modules.mvp.sourceUrl}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={filter === 'favorites' || filter === 'alerts' ? Hourglass : SearchX}
          title="No hay resultados"
        >
          {filter === 'favorites'
            ? 'Marca MVPs con la estrella para verlos aquí.'
            : filter === 'alerts'
              ? 'Pulsa la campana de un MVP para elegir cómo avisarte.'
              : 'Prueba con otro filtro o búsqueda.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((mvp) => (
            <MvpCard
              key={`${mvp.id}-${mvp.name}`}
              mvp={mvp}
              favorite={favorites.values.has(mvp.id)}
              onToggleFavorite={favorites.toggle}
              alertChannel={alerts.channelOf(mvp.id)}
              alertConfig={alerts.config}
              onAlertChannelChange={alerts.setChannel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
