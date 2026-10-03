import type { MarketShop } from '@hrc/shared';
import { Link } from '@tanstack/react-router';
import { MapPin, User } from 'lucide-react';
import { formatCount, formatZeny } from '@/lib/format';
import { ItemIcon } from './ItemIcon';
import { marketMeta } from './market-meta';
import { shopTotals } from './market-query';

const PREVIEW = 6;

export function ShopCard({ shop }: { shop: MarketShop }) {
  const meta = marketMeta[shop.type];
  const { units, value } = shopTotals(shop);
  const detailPath =
    shop.type === 'vending' ? '/mercados/vending/$shopId' : '/mercados/buying-store/$shopId';

  return (
    <article className="group relative flex flex-col rounded-card border border-white/7 bg-night-850/80 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-gold-400/35 sm:p-5">
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>{meta.shopLabel}</span>
        <span className="tabular-nums">#{shop.id}</span>
      </div>
      <h2 className="mt-2 line-clamp-2 font-semibold text-ink group-hover:text-gold-200">
        <Link
          to={detailPath}
          params={{ shopId: String(shop.id) }}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {shop.title || 'Tienda sin título'}
        </Link>
      </h2>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <User aria-hidden="true" className="size-3.5 text-ink-faint" />
          <span className="sr-only">{meta.ownerLabel}:</span>
          {shop.owner}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
          <MapPin aria-hidden="true" className="size-3.5 text-ink-faint" />
          {shop.map}
          {shop.x !== null && ` ${shop.x}, ${shop.y}`}
        </span>
      </p>

      <ul aria-label="Objetos" className="mt-4 mb-4 flex flex-wrap gap-1.5">
        {shop.items.slice(0, PREVIEW).map((item, index) => (
          <li key={`${item.itemId}-${index}`} title={item.name}>
            <ItemIcon src={item.iconUrl} name={item.name} className="size-9" />
          </li>
        ))}
        {shop.items.length > PREVIEW && (
          <li className="grid size-9 place-items-center rounded-lg bg-white/5 text-xs text-ink-muted">
            +{shop.items.length - PREVIEW}
          </li>
        )}
      </ul>

      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-white/6 pt-3 text-xs">
        <div>
          <dt className="text-ink-faint">Objetos</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink">{shop.items.length}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Unidades</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink">{formatCount(units)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">{meta.totalLabel}</dt>
          <dd className="mt-0.5 truncate font-medium tabular-nums text-gold-300">
            {formatZeny(value)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
