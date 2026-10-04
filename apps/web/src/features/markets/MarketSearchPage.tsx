import type { MarketOffer, MarketType } from '@hikari-hub/shared';
import { useQuery } from '@tanstack/react-query';
import { PackageSearch, Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { MarketSearchBox } from './MarketSearchBox';
import { MarketSwitch } from './MarketSwitch';
import { OfferTable } from './OfferTable';
import { marketMeta } from './market-meta';
import { marketSearchQuery } from './market-query';

function ResultSection({ type, offers }: { type: MarketType; offers: MarketOffer[] }) {
  const meta = marketMeta[type];
  const Icon = meta.icon;
  return (
    <section aria-labelledby={`results-${type}`} className="flex flex-col gap-3">
      <h2
        id={`results-${type}`}
        className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
      >
        <Icon aria-hidden="true" className="size-5 text-gold-300" />
        {meta.label}
        <span className="text-sm font-normal text-ink-faint">({offers.length})</span>
      </h2>
      <p className="-mt-2 text-xs text-ink-faint">
        {type === 'vending'
          ? 'Ordenado del precio más bajo al más alto.'
          : 'Ordenado de la mejor a la peor oferta.'}
      </p>
      {offers.length === 0 ? (
        <p className="rounded-card border border-dashed border-white/10 px-4 py-6 text-center text-sm text-ink-muted">
          {type === 'vending'
            ? 'Nadie lo vende ahora mismo.'
            : 'Nadie lo está comprando ahora mismo.'}
        </p>
      ) : (
        <OfferTable offers={offers} type={type} />
      )}
    </section>
  );
}

export function MarketSearchPage({ query }: { query: string }) {
  const trimmed = query.trim();
  const { data, error, isFetching, isPlaceholderData, refetch } = useQuery(
    marketSearchQuery(trimmed),
  );
  const ready = trimmed.length >= 2;

  return (
    <div className="flex flex-col gap-6 animate-rise">
      <PageHeader
        eyebrow="Mercados"
        title="Buscar item"
        description="Encuentra quién vende y quién compra un objeto en todo el servidor."
        actions={<MarketSwitch />}
      />
      <MarketSearchBox initialQuery={trimmed} autoFocus />

      {!ready ? (
        <EmptyState icon={Search} title="¿Qué estás buscando?">
          Escribe al menos 2 letras del nombre del objeto o de una carta insertada.
        </EmptyState>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !data ? (
        <div aria-busy="true" aria-label="Buscando" className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 rounded-card" />
        </div>
      ) : data.vending.length === 0 && data.buying.length === 0 && !isPlaceholderData ? (
        <EmptyState icon={PackageSearch} title={`Sin resultados para «${data.query}»`}>
          Ninguna tienda abierta vende ni compra ese objeto ahora mismo.
        </EmptyState>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-8 transition-opacity',
            isFetching && isPlaceholderData && 'opacity-60',
          )}
          aria-busy={isFetching || undefined}
        >
          <p className="text-xs text-ink-faint">
            Datos de las tiendas abiertas · actualizado {formatRelative(data.updatedAt)}
          </p>
          <ResultSection type="vending" offers={data.vending} />
          <ResultSection type="buying" offers={data.buying} />
        </div>
      )}
    </div>
  );
}
