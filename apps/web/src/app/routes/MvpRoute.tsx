import { getRouteApi } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { MvpPage } from '@/features/mvp/MvpPage';

const route = getRouteApi('/app/mvp');

export function MvpRoute() {
  const { filter, q } = route.useSearch();
  const navigate = route.useNavigate();

  // La página escribe su búsqueda en la URL. Solo se reinicia cuando la búsqueda llega de
  // fuera (p. ej. desde la búsqueda global), no cuando el cambio es el que ella misma escribió.
  const [ownQuery, setOwnQuery] = useState(q ?? '');
  const [seenQuery, setSeenQuery] = useState(q);
  const [instance, setInstance] = useState(0);
  if (q !== seenQuery) {
    setSeenQuery(q);
    if ((q ?? '') !== ownQuery) {
      setOwnQuery(q ?? '');
      setInstance((value) => value + 1);
    }
  }

  const handleQueryChange = useCallback(
    (next: string) => {
      setOwnQuery(next);
      void navigate({ search: (prev) => ({ ...prev, q: next || undefined }), replace: true });
    },
    [navigate],
  );

  return (
    <MvpPage
      key={instance}
      initialQuery={q}
      filter={filter}
      onFilterChange={(next) =>
        void navigate({ search: (prev) => ({ ...prev, filter: next }), replace: true })
      }
      onQueryChange={handleQueryChange}
    />
  );
}
