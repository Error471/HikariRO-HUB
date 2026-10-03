import type { MarketItem, MarketType } from '@hrc/shared';
import { formatCount, formatZeny } from '@/lib/format';
import { ItemIcon } from './ItemIcon';
import { marketMeta } from './market-meta';

const HIKARI = 'https://hikariro.com';

export function ItemExtras({ item }: { item: MarketItem }) {
  if (item.extras.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      {item.extras.map((extra) => (
        <p key={extra.label} className="text-xs text-ink-muted">
          <span className="text-ink-faint">{extra.label}: </span>
          {extra.entries.map((entry, index) => (
            <span key={`${entry.name}-${index}`}>
              {index > 0 && ' · '}
              {entry.itemId ? (
                <a
                  href={`${HIKARI}/?module=item&action=view&id=${entry.itemId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-mana-300 hover:underline"
                >
                  {entry.name}
                </a>
              ) : (
                entry.name
              )}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export function ItemName({ item }: { item: MarketItem }) {
  return (
    <a
      href={item.detailUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-ink hover:text-gold-200"
    >
      {item.refine ? <span className="text-gold-300">+{item.refine} </span> : null}
      {item.name}
      {item.slots ? <span className="text-ink-faint"> [{item.slots}]</span> : null}
    </a>
  );
}

export function MarketItemCard({ item, type }: { item: MarketItem; type: MarketType }) {
  const meta = marketMeta[type];
  return (
    <article className="flex gap-4 rounded-card border border-white/7 bg-night-850/80 p-4">
      <ItemIcon src={item.iconUrl} name={item.name} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-faint">ID {item.itemId}</p>
        <h3 className="mt-0.5 leading-snug">
          <ItemName item={item} />
        </h3>
        <ItemExtras item={item} />
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-ink-faint">{meta.priceLabel}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-gold-300">
              {formatZeny(item.unitPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">{meta.amountLabel}</dt>
            <dd className="mt-0.5 tabular-nums text-ink">{formatCount(item.amount)}</dd>
          </div>
          {item.amount > 1 && (
            <div>
              <dt className="text-ink-faint">Total</dt>
              <dd className="mt-0.5 tabular-nums text-ink-muted">
                {formatZeny(item.amount * item.unitPrice)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  );
}
