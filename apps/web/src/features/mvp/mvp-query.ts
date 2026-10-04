import { mvpListResponseSchema } from '@hikari-hub/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

/** Igual que la web original: se refresca cada 15 s y la cuenta atrás se calcula en cliente. */
export const MVP_REFRESH_MS = 15_000;

export const mvpQuery = queryOptions({
  queryKey: ['mvp'],
  queryFn: ({ signal }) => apiRequest('/mvp', { schema: mvpListResponseSchema, signal }),
  staleTime: 10_000,
});

export function useMvpList() {
  const query = useQuery({ ...mvpQuery, refetchInterval: MVP_REFRESH_MS });
  // Diferencia entre el reloj de HikariRO y el del navegador en el momento de la respuesta.
  const offset = query.data ? query.data.serverNow - query.dataUpdatedAt / 1000 : 0;
  return { ...query, offset };
}
