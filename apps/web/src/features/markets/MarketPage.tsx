import type { MarketShop, MarketType } from '@hrc/shared';
import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatRelative } from '@/lib/format';
import { MarketSearchBox } from './MarketSearchBox';
import { MarketSwitch } from './MarketSwitch';
import { ShopCard } from './ShopCard';
import { marketMeta } from './market-meta';
import { marketListQuery, normalizeText, shopTotals } from './market-query';

export type ShopSort = 'id' | 'owner' | 'map' | 'value';

const sorters: Record<ShopSort, (a: MarketShop, b: MarketShop) => number> = {
  id: (a, b) => a.id - b.id,
  owner: (a, b) => a.owner.localeCompare(b.owner),
  map: (a, b) => a.map.localeCompare(b.map) || a.id - b.id,
  value: (a, b) => shopTotals(b).value - shopTotals(a).value,
};

function matchesShop(shop: MarketShop, needle: string): boolean {
  if (!needle) return true;
  return [shop.title, shop.owner, shop.map, ...shop.items.map((item) => item.name)].some((text) =>
    normalizeText(text).includes(needle),
  );
}

interface MarketPageProps {
  type: MarketType;
  sort: ShopSort;
  onSortChange: (sort: ShopSort) => void;
}

export function MarketPage({ type, sort, onSortChange }: MarketPageProps) {
  const meta = marketMeta[type];
  const { data, error, isPending, refetch } = useQuery(marketListQuery(type));
  const [filter, setFilter] = useState('');
  const needle = normalizeText(useDeferredValue(filter));
  const shops = (data?.shops ?? []).filter((shop) => matchesShop(shop, needle)).sort(sorters[sort]);

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <PageHeader
        eyebrow="Mercados"
        title={meta.label}
        description={
          type === 'vending'
            ? 'Tiendas de venta abiertas por los jugadores.'
            : 'Jugadores que buscan comprar objetos.'
        }
        actions={<MarketSwitch />}
      />

      <MarketSearchBox />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          label="Filtrar tiendas"
          placeholder="Filtrar tiendas…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="sm:w-96"
        />
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          {data && (
            <span className="hidden text-xs text-ink-faint md:inline">
              {data.shops.length} tiendas · actualizado {formatRelative(data.updatedAt)}
            </span>
          )}
          <label className="flex items-center gap-2">
            Ordenar
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as ShopSort)}
              className="min-h-10 rounded-lg border border-white/10 bg-night-850 px-3 text-sm text-ink focus:border-gold-400/50 focus:outline-none"
            >
              <option value="id">Nº de tienda</option>
              <option value="owner">{meta.ownerLabel}</option>
              <option value="map">Mapa</option>
              <option value="value">{meta.totalLabel}</option>
            </select>
          </label>
        </div>
      </div>

      {isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando tiendas"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-56 rounded-card" />
          ))}
        </div>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} fallbackUrl={meta.sourceUrl} />
      ) : shops.length === 0 ? (
        <EmptyState
          icon={Store}
          title={filter ? 'Ninguna tienda coincide' : 'No hay tiendas abiertas'}
        >
          {filter ? 'Prueba con otro texto.' : 'Vuelve a mirar en un rato.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}
