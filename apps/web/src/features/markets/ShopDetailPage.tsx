import type { MarketType } from '@hrc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, ChevronRight, MapPin, PackageSearch, Store, User } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api-client';
import { formatCount, formatZeny } from '@/lib/format';
import { MarketItemCard } from './MarketItemCard';
import { marketMeta } from './market-meta';
import { marketListQuery, marketShopQuery, normalizeText, shopTotals } from './market-query';

export function ShopDetailPage({ type, shopId }: { type: MarketType; shopId: number }) {
  const meta = marketMeta[type];
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({
    ...marketShopQuery(type, shopId),
    // Si venimos del listado, la tienda ya está en cache: se muestra al instante.
    initialData: () => {
      const list = queryClient.getQueryData(marketListQuery(type).queryKey);
      const shop = list?.shops.find((candidate) => candidate.id === shopId);
      return shop && list ? { updatedAt: list.updatedAt, shop } : undefined;
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(marketListQuery(type).queryKey)?.dataUpdatedAt,
  });
  const [filter, setFilter] = useState('');
  const needle = normalizeText(useDeferredValue(filter));

  const breadcrumbs = (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1 text-sm text-ink-muted">
      <span>Mercados</span>
      <ChevronRight aria-hidden="true" className="size-4 text-ink-faint" />
      <Link to={meta.path} className="hover:text-ink">
        {meta.label}
      </Link>
      <ChevronRight aria-hidden="true" className="size-4 text-ink-faint" />
      <span className="text-ink-faint">#{shopId}</span>
    </nav>
  );

  if (isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando tienda" className="flex flex-col gap-4">
        {breadcrumbs}
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  if (error && !data) {
    const closed = error instanceof ApiError && error.code === 'NOT_FOUND';
    return (
      <div className="flex flex-col gap-6">
        {breadcrumbs}
        {closed ? (
          <EmptyState icon={Store} title="Tienda no disponible">
            {error.message}{' '}
            <Link to={meta.path} className="text-gold-300 hover:underline">
              Volver a {meta.label}
            </Link>
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const { shop } = data;
  const { units, value } = shopTotals(shop);
  const items = shop.items.filter(
    (item) =>
      !needle ||
      normalizeText(item.name).includes(needle) ||
      item.extras.some((extra) =>
        extra.entries.some((entry) => normalizeText(entry.name).includes(needle)),
      ),
  );

  return (
    <div className="flex flex-col gap-6 animate-rise">
      {breadcrumbs}

      <section className="frame-gold rounded-card p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400/80">
          {meta.shopLabel}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-wide text-balance sm:text-3xl">
          {shop.title || 'Tienda sin título'}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <User aria-hidden="true" className="size-4 text-ink-faint" />
            {meta.ownerLabel}: <strong className="font-medium text-ink">{shop.owner}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <MapPin aria-hidden="true" className="size-4 text-ink-faint" />
            {shop.map}
            {shop.x !== null && ` ${shop.x}, ${shop.y}`}
          </span>
          <a
            href={shop.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-ink-faint hover:text-ink"
          >
            Ver en HikariRO <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/8 pt-4 text-sm">
          <div>
            <dt className="text-xs text-ink-faint">Objetos</dt>
            <dd className="mt-1 font-semibold tabular-nums">{shop.items.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Unidades</dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatCount(units)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">{meta.totalLabel}</dt>
            <dd className="mt-1 text-sm font-semibold whitespace-nowrap tabular-nums text-gold-300 sm:text-base">
              {formatZeny(value)}
            </dd>
          </div>
        </dl>
      </section>

      {shop.items.length > 4 && (
        <SearchInput
          label="Filtrar objetos de la tienda"
          placeholder="Filtrar objetos o cartas…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="sm:w-96"
        />
      )}

      {items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No hay objetos que coincidan" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item, index) => (
            <MarketItemCard key={`${item.itemId}-${index}`} item={item} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}
