import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

/** Cualquier SESSION_EXPIRED de cualquier módulo marca la sesión como caducada. */
function handleExpiredSession(client: () => QueryClient, error: unknown) {
  if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') {
    client().setQueryData(['session'], { status: 'anonymous', reason: 'expired' });
  }
}

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => handleExpiredSession(() => client, error) }),
    mutationCache: new MutationCache({
      onError: (error) => handleExpiredSession(() => client, error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          failureCount < 2 &&
          error instanceof ApiError &&
          ['NETWORK_ERROR', 'UPSTREAM_UNAVAILABLE'].includes(error.code),
      },
    },
  });
  return client;
}
