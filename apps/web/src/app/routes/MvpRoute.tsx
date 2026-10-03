import { getRouteApi } from '@tanstack/react-router';
import { MvpPage } from '@/features/mvp/MvpPage';

const route = getRouteApi('/app/mvp');

export function MvpRoute() {
  const { filter } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <MvpPage
      filter={filter}
      onFilterChange={(next) => void navigate({ search: { filter: next }, replace: true })}
    />
  );
}
