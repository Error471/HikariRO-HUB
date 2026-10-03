import type { MarketType } from '@hrc/shared';
import { getRouteApi } from '@tanstack/react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { MarketPage } from '@/features/markets/MarketPage';
import { MarketSearchPage } from '@/features/markets/MarketSearchPage';
import { ShopDetailPage } from '@/features/markets/ShopDetailPage';
import { Store } from 'lucide-react';

const vendingApi = getRouteApi('/app/mercados/vending');
const buyingApi = getRouteApi('/app/mercados/buying-store');
const vendingShopApi = getRouteApi('/app/mercados/vending/$shopId');
const buyingShopApi = getRouteApi('/app/mercados/buying-store/$shopId');
const searchApi = getRouteApi('/app/mercados/buscar');

export function VendingRoute() {
  const { sort } = vendingApi.useSearch();
  const navigate = vendingApi.useNavigate();
  return (
    <MarketPage
      type="vending"
      sort={sort}
      onSortChange={(next) => void navigate({ search: { sort: next }, replace: true })}
    />
  );
}

export function BuyingRoute() {
  const { sort } = buyingApi.useSearch();
  const navigate = buyingApi.useNavigate();
  return (
    <MarketPage
      type="buying"
      sort={sort}
      onSortChange={(next) => void navigate({ search: { sort: next }, replace: true })}
    />
  );
}

function ShopRoute({ type, rawId }: { type: MarketType; rawId: string }) {
  const shopId = Number(rawId);
  if (!Number.isInteger(shopId) || shopId <= 0) {
    return <EmptyState icon={Store} title="Tienda no válida" />;
  }
  return <ShopDetailPage key={`${type}-${shopId}`} type={type} shopId={shopId} />;
}

export function VendingShopRoute() {
  return <ShopRoute type="vending" rawId={vendingShopApi.useParams().shopId} />;
}

export function BuyingShopRoute() {
  return <ShopRoute type="buying" rawId={buyingShopApi.useParams().shopId} />;
}

export function MarketSearchRoute() {
  return <MarketSearchPage query={searchApi.useSearch().q} />;
}
