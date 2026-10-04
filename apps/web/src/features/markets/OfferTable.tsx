import type { MarketOffer, MarketType } from '@hikari-hub/shared';
import { Link } from '@tanstack/react-router';
import { formatCount, formatZeny } from '@/lib/format';
import { ItemIcon } from './ItemIcon';
import { ItemExtras, ItemName } from './MarketItemCard';
import { marketMeta } from './market-meta';

function ShopLink({ offer }: { offer: MarketOffer }) {
  const to =
    offer.shop.type === 'vending' ? '/mercados/vending/$shopId' : '/mercados/buying-store/$shopId';
  return (
    <Link to={to} params={{ shopId: String(offer.shop.id) }} className="group/shop block">
      <span className="block font-medium text-ink group-hover/shop:text-gold-200">
        {offer.shop.owner}
      </span>
      <span className="block truncate text-xs text-ink-faint">{offer.shop.title}</span>
    </Link>
  );
}

function location(offer: MarketOffer): string {
  return offer.shop.x === null
    ? offer.shop.map
    : `${offer.shop.map} ${offer.shop.x}, ${offer.shop.y}`;
}

/** Tabla en escritorio y tarjetas compactas en móvil. */
export function OfferTable({ offers, type }: { offers: MarketOffer[]; type: MarketType }) {
  const meta = marketMeta[type];
  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-white/7 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-night-800/80 text-xs uppercase tracking-wider text-ink-faint">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Objeto
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {meta.ownerLabel}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Ubicación
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {meta.priceLabel}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {meta.amountLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6 bg-night-850/60">
            {offers.map((offer, index) => (
              <tr
                key={`${offer.shop.id}-${offer.item.itemId}-${index}`}
                className="align-top hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <ItemIcon src={offer.item.iconUrl} name={offer.item.name} className="size-9" />
                    <div className="min-w-0">
                      <ItemName item={offer.item} />
                      <ItemExtras item={offer.item} />
                    </div>
                  </div>
                </td>
                <td className="max-w-56 px-4 py-3">
                  <ShopLink offer={offer} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">{location(offer)}</td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums text-gold-300">
                  {formatZeny(offer.item.unitPrice)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCount(offer.item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {offers.map((offer, index) => (
          <li
            key={`${offer.shop.id}-${offer.item.itemId}-${index}`}
            className="rounded-card border border-white/7 bg-night-850/80 p-3.5"
          >
            <div className="flex gap-3">
              <ItemIcon src={offer.item.iconUrl} name={offer.item.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <ItemName item={offer.item} />
                <ItemExtras item={offer.item} />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 text-sm">
              <div className="min-w-0">
                <ShopLink offer={offer} />
                <span className="font-mono text-xs text-ink-faint">{location(offer)}</span>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums text-gold-300">
                  {formatZeny(offer.item.unitPrice)}
                </p>
                <p className="text-xs text-ink-faint">
                  {formatCount(offer.item.amount)} {meta.unit(offer.item.amount)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
