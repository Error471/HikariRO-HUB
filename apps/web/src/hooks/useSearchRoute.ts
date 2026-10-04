import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** Página desde la que se empezó a buscar, para volver al borrar la búsqueda. */
    searchFrom?: string;
  }
}

type SearchPath = '/wiki/buscar' | '/mercados/buscar';

interface SearchRouteOptions {
  to: SearchPath;
  initialQuery: string;
  /** Adónde volver al borrar si no se sabe de qué página se vino. */
  fallback?: string;
}

const MIN_LENGTH = 2;

/**
 * Buscador que vive en la URL: al escribir lleva a la página de resultados y, al borrar
 * todo el texto, devuelve a la página desde la que se empezó a buscar.
 */
export function useSearchRoute({ to, initialQuery, fallback }: SearchRouteOptions) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const [value, setValue] = useState(initialQuery);
  const debounced = useDebouncedValue(value.trim(), 350);
  const lastSent = useRef(initialQuery.trim());

  useEffect(() => {
    if (debounced === lastSent.current) return;
    if (debounced.length > 0 && debounced.length < MIN_LENGTH) return;
    lastSent.current = debounced;
    const onSearchPage = location.pathname === to;

    if (!debounced) {
      const origin = location.state.searchFrom ?? fallback;
      if (onSearchPage && origin) void navigate({ href: origin, replace: true });
      return;
    }

    void navigate({
      to,
      search: { q: debounced },
      replace: onSearchPage,
      state: { searchFrom: onSearchPage ? location.state.searchFrom : location.href },
    });
  }, [debounced, fallback, location, navigate, to]);

  return [value, setValue] as const;
}
