import { favoritesSchema } from '@hikari-hub/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { apiRequest, errorMessage } from '@/lib/api-client';

/** Clave de la versión anterior, cuando los favoritos se guardaban solo en el navegador. */
const LEGACY_KEY = 'hrc:mvp-favorites';

export const favoritesQuery = queryOptions({
  queryKey: ['mvp', 'favorites'],
  queryFn: ({ signal }) => apiRequest('/mvp/favorites', { schema: favoritesSchema, signal }),
  staleTime: 60_000,
});

function readLegacyFavorites(): number[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function clearLegacyFavorites(): void {
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Sin acceso al almacenamiento: no hay nada que limpiar.
  }
}

/** Favoritos de MVP guardados en la cuenta (se sincronizan entre dispositivos). */
export function useFavorites() {
  const queryClient = useQueryClient();
  const { data, isSuccess } = useQuery(favoritesQuery);

  const save = useMutation({
    scope: { id: 'mvp-favorites' },
    mutationFn: (ids: number[]) =>
      apiRequest('/mvp/favorites', { method: 'PUT', body: { ids }, schema: favoritesSchema }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: favoritesQuery.queryKey });
      const previous = queryClient.getQueryData(favoritesQuery.queryKey);
      queryClient.setQueryData(favoritesQuery.queryKey, { ids });
      return { previous };
    },
    onError: (error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(favoritesQuery.queryKey, context.previous);
      toast.error(errorMessage(error));
    },
  });
  const { mutate } = save;

  // Migración única de los favoritos que estaban en este navegador.
  useEffect(() => {
    if (!isSuccess) return;
    const legacy = readLegacyFavorites();
    if (!legacy.length) return;
    clearLegacyFavorites();
    const merged = [...new Set([...data.ids, ...legacy])];
    if (merged.length !== data.ids.length) mutate(merged);
  }, [isSuccess, data, mutate]);

  const values = useMemo(() => new Set(data?.ids ?? []), [data]);

  const toggle = useCallback(
    (id: number) => {
      const current = queryClient.getQueryData(favoritesQuery.queryKey)?.ids ?? [];
      mutate(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    },
    [queryClient, mutate],
  );

  return { values, toggle };
}
