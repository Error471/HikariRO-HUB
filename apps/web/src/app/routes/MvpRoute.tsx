import { getRouteApi } from '@tanstack/react-router';
import { MvpPage } from '@/features/mvp/MvpPage';

const route = getRouteApi('/app/mvp');

export function MvpRoute() {
  const { filter, q } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <MvpPage
      key={q ?? ''}
      initialQuery={q}
      filter={filter}
      onFilterChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, filter: next }), replace: true })
      }
    />
  );
}
