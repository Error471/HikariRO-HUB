import { CircleHelp, Hourglass, RefreshCw, SearchX } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { modules } from '@/app/navigation';
import { subtleButtonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterOption } from '@/components/ui/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';
import { NotificationsDialog } from '@/features/notifications/NotificationsDialog';
import { useMvpChannels } from '@/features/notifications/alerts';
import { useFavorites } from './favorites';
import { MvpCard, stateStyles } from './MvpCard';
import { useMvpList } from './mvp-query';
import {
  filterMvps,
  sortMvpViews,
  stateDescriptions,
  stateLabels,
  toMvpView,
  type MvpFilter,
  type SpawnStateKey,
} from './mvp-status';

interface MvpPageProps {
  initialQuery?: string;
  filter: MvpFilter;
  onFilterChange: (filter: MvpFilter) => void;
  /** Guarda la búsqueda en la URL para poder compartirla o recargar sin perderla. */
  onQueryChange?: (query: string) => void;
}

const legendOrder: SpawnStateKey[] = ['window', 'cooldown', 'ready'];

/** Qué significa cada estado, a la vista con teclado y en táctil (no solo al pasar el ratón). */
function StateLegend() {
  return (
    <details className="group text-sm">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg text-ink-muted transition-colors hover:text-ink pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
        <CircleHelp aria-hidden="true" className="size-4 shrink-0" />
        Qué significa cada estado
      </summary>
      <dl className="mt-2 grid gap-x-6 gap-y-3 rounded-card surface p-4 sm:grid-cols-3">
        {legendOrder.map((key) => (
          <div key={key}>
            <dt className="flex items-center gap-2 font-medium text-ink">
              <span
                aria-hidden="true"
                className={cn('size-2 shrink-0 rounded-full', stateStyles[key].bar)}
              />
              {stateLabels[key]}
            </dt>
            <dd className="mt-1 text-ink-muted">{stateDescriptions[key]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
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

export function MvpPage({
  initialQuery = '',
  filter,
  onFilterChange,
  onQueryChange,
}: MvpPageProps) {
  const { data, error, isPending, isFetching, refetch, offset } = useMvpList();
  const favorites = useFavorites();
  const alerts = useMvpChannels();
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const settledQuery = useDebouncedValue(query.trim(), 350);
  const lastSent = useRef(initialQuery.trim());

  useEffect(() => {
    if (settledQuery === lastSent.current) return;
    lastSent.current = settledQuery;
    onQueryChange?.(settledQuery);
  }, [settledQuery, onQueryChange]);
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
              className={cn(subtleButtonClass, 'disabled:opacity-60')}
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

      {/* En escritorio, filtros y búsqueda quedan fijos al desplazarse por la lista. */}
      <div className="z-10 flex flex-col gap-3 lg:sticky lg:top-16 lg:-mx-10 lg:-my-3 lg:bg-night-900/90 lg:px-10 lg:py-3 lg:backdrop-blur-md xl:flex-row xl:items-start xl:justify-between">
        <FilterTabs
          label="Filtrar por estado"
          options={options}
          value={filter}
          onChange={onFilterChange}
        />
        <SearchInput
          label="Buscar MVP o mapa"
          className="xl:w-72 xl:shrink-0"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar MVP o mapa…"
        />
      </div>

      <StateLegend />

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
        <div className="stagger grid gap-4 xl:grid-cols-2">
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
