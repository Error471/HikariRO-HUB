import { getRouteApi } from '@tanstack/react-router';
import { CardAlbumPage } from '@/features/albums/CardAlbumPage';
import { FishingAlbumPage } from '@/features/albums/FishingAlbumPage';

const cardsRoute = getRouteApi('/app/albumes/cartas');
const fishingRoute = getRouteApi('/app/albumes/pesca');

export function CardAlbumRoute() {
  const params = cardsRoute.useSearch();
  const navigate = cardsRoute.useNavigate();
  return (
    <CardAlbumPage
      params={params}
      onParamsChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
      }
    />
  );
}

export function FishingAlbumRoute() {
  const { filter } = fishingRoute.useSearch();
  const navigate = fishingRoute.useNavigate();
  return (
    <FishingAlbumPage
      filter={filter}
      onFilterChange={(next) => void navigate({ search: { filter: next }, replace: true })}
    />
  );
}
