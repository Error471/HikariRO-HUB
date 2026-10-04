import { sessionResponseSchema, type LoginRequest, type SessionResponse } from '@hikari-hub/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest, setCsrfToken } from '@/lib/api-client';

export type SessionState =
  | { status: 'authenticated'; session: SessionResponse }
  | { status: 'anonymous'; reason: 'none' | 'expired' };

export const SESSION_REFRESH_MS = 5 * 60_000;

async function fetchSession(): Promise<SessionState> {
  try {
    const session = await apiRequest('/auth/me', { schema: sessionResponseSchema });
    setCsrfToken(session.csrfToken);
    return { status: 'authenticated', session };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
      setCsrfToken(null);
      return { status: 'anonymous', reason: 'none' };
    }
    if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') {
      setCsrfToken(null);
      return { status: 'anonymous', reason: 'expired' };
    }
    throw error;
  }
}

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: fetchSession,
  staleTime: 60_000,
  retry: (failureCount, error) =>
    failureCount < 2 && error instanceof ApiError && error.code === 'NETWORK_ERROR',
});

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      apiRequest('/auth/login', {
        method: 'POST',
        body: credentials,
        schema: sessionResponseSchema,
      }),
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      const state: SessionState = { status: 'authenticated', session };
      queryClient.setQueryData(sessionQuery.queryKey, state);
    },
  });
}

function useClearSession() {
  const queryClient = useQueryClient();
  return () => {
    setCsrfToken(null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    const state: SessionState = { status: 'anonymous', reason: 'none' };
    queryClient.setQueryData(sessionQuery.queryKey, state);
  };
}

export function useLogout() {
  const clearSession = useClearSession();
  return useMutation({
    mutationFn: () => apiRequest('/auth/logout', { method: 'POST' }),
    onSettled: clearSession,
  });
}

/** Borra favoritos, avisos y la sesión de Hikari Hub. */
export function useDeleteAccountData() {
  const clearSession = useClearSession();
  return useMutation({
    mutationFn: () => apiRequest('/account/data', { method: 'DELETE' }),
    onSuccess: clearSession,
  });
}
