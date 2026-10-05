import {
  alertConfigResponseSchema,
  type AlertChannel,
  type AlertConfigResponse,
  type AlertSettings,
} from '@hikari-hub/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRequest, errorMessage } from '@/lib/api-client';

export type ChannelChoice = AlertChannel | 'none';
export type TestChannel = 'windows' | 'telegram';

export const alertConfigQuery = queryOptions({
  queryKey: ['alerts', 'config'],
  queryFn: ({ signal }) =>
    apiRequest('/alerts/config', { schema: alertConfigResponseSchema, signal }),
  staleTime: 60_000,
});

const send = (path: string, method: 'PUT' | 'POST' | 'DELETE', body?: unknown) =>
  apiRequest(path, { method, body, schema: alertConfigResponseSchema });

/** Configuración de los avisos de MVP (Windows y Telegram). */
export function useMvpAlerts() {
  const queryClient = useQueryClient();
  const config = useQuery(alertConfigQuery);
  const store = (next: AlertConfigResponse) =>
    queryClient.setQueryData(alertConfigQuery.queryKey, next);

  const update = useMutation({
    mutationFn: (settings: AlertSettings) => send('/alerts/settings', 'PUT', settings),
    onSuccess: store,
  });

  const connectTelegram = useMutation({
    mutationFn: (botToken: string) => send('/alerts/telegram', 'PUT', { botToken }),
    onSuccess: store,
  });

  const detectTelegramChat = useMutation({
    mutationFn: () => send('/alerts/telegram/detect', 'POST'),
    onSuccess: store,
  });

  const linkTelegramChat = useMutation({
    mutationFn: (chatId: string) => send('/alerts/telegram/chat', 'PUT', { chatId }),
    onSuccess: store,
  });

  const disconnectTelegram = useMutation({
    mutationFn: () => send('/alerts/telegram', 'DELETE'),
    onSuccess: store,
  });

  const sendTest = useMutation({
    mutationFn: (channel: TestChannel) =>
      apiRequest('/alerts/test', { method: 'POST', body: { channel } }),
  });

  return {
    config,
    update,
    connectTelegram,
    detectTelegramChat,
    linkTelegramChat,
    disconnectTelegram,
    sendTest,
  };
}

/** Canal de aviso de cada MVP, con actualización optimista. */
export function useMvpChannels() {
  const queryClient = useQueryClient();
  const { data } = useQuery(alertConfigQuery);

  const setChannel = useMutation({
    scope: { id: 'mvp-alert-channels' },
    mutationFn: ({ mvpId, channel }: { mvpId: number; channel: ChannelChoice }) =>
      send(`/alerts/mvps/${mvpId}`, 'PUT', { channel }),
    onMutate: async ({ mvpId, channel }) => {
      await queryClient.cancelQueries({ queryKey: alertConfigQuery.queryKey });
      const previous = queryClient.getQueryData(alertConfigQuery.queryKey);
      if (previous) {
        const others = Object.entries(previous.channels).filter(([id]) => id !== String(mvpId));
        const channels = Object.fromEntries(
          channel === 'none' ? others : [...others, [String(mvpId), channel]],
        );
        queryClient.setQueryData(alertConfigQuery.queryKey, { ...previous, channels });
      }
      return { previous };
    },
    onSuccess: (next) => queryClient.setQueryData(alertConfigQuery.queryKey, next),
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(alertConfigQuery.queryKey, context.previous);
      toast.error(errorMessage(error));
    },
  });

  return {
    config: data,
    channelOf: (mvpId: number): ChannelChoice => data?.channels[mvpId] ?? 'none',
    alerted: new Set(Object.keys(data?.channels ?? {}).map(Number)),
    setChannel: (mvpId: number, channel: ChannelChoice) => setChannel.mutate({ mvpId, channel }),
  };
}
