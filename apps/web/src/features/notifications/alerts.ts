import {
  alertConfigResponseSchema,
  type AlertConfigResponse,
  type AlertSettings,
} from '@hikari-hub/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

export const alertConfigQuery = queryOptions({
  queryKey: ['alerts', 'config'],
  queryFn: ({ signal }) =>
    apiRequest('/alerts/config', { schema: alertConfigResponseSchema, signal }),
  staleTime: 60_000,
});

/** Estado y acciones de los avisos de MVP (notificaciones de Windows). */
export function useMvpAlerts() {
  const queryClient = useQueryClient();
  const config = useQuery(alertConfigQuery);

  const update = useMutation({
    mutationFn: (settings: AlertSettings) =>
      apiRequest('/alerts/settings', {
        method: 'PUT',
        body: settings,
        schema: alertConfigResponseSchema,
      }),
    onSuccess: (next: AlertConfigResponse) =>
      queryClient.setQueryData(alertConfigQuery.queryKey, next),
  });

  const sendTest = useMutation({
    mutationFn: () => apiRequest('/alerts/test', { method: 'POST' }),
  });

  return { config, update, sendTest };
}
