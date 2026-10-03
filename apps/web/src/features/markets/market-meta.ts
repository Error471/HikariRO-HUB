import type { MarketType } from '@hrc/shared';
import { ShoppingBag, Store, type LucideIcon } from 'lucide-react';

export interface MarketMeta {
  type: MarketType;
  label: string;
  shopLabel: string;
  ownerLabel: string;
  priceLabel: string;
  amountLabel: string;
  /** Unidad para "N disponibles" / "N solicitadas". */
  unit: (count: number) => string;
  totalLabel: string;
  path: '/mercados/vending' | '/mercados/buying-store';
  icon: LucideIcon;
  sourceUrl: string;
}

export const marketMeta: Record<MarketType, MarketMeta> = {
  vending: {
    type: 'vending',
    label: 'Vending',
    shopLabel: 'Tienda de venta',
    ownerLabel: 'Vendedor',
    priceLabel: 'Precio unitario',
    amountLabel: 'Disponibles',
    unit: (count) => (count === 1 ? 'disponible' : 'disponibles'),
    totalLabel: 'Valor total',
    path: '/mercados/vending',
    icon: Store,
    sourceUrl: 'https://hikariro.com/?module=vending',
  },
  buying: {
    type: 'buying',
    label: 'Buying Store',
    shopLabel: 'Tienda de compra',
    ownerLabel: 'Comprador',
    priceLabel: 'Oferta por unidad',
    amountLabel: 'Solicitadas',
    unit: (count) => (count === 1 ? 'solicitada' : 'solicitadas'),
    totalLabel: 'Oferta total',
    path: '/mercados/buying-store',
    icon: ShoppingBag,
    sourceUrl: 'https://hikariro.com/?module=buyingstore',
  },
};
