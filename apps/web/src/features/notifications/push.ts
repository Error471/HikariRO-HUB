import { pushConfigResponseSchema, type LeadMinutes, type PushConfigResponse } from '@hrc/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, ApiError } from '@/lib/api-client';

export const pushConfigQuery = queryOptions({
  queryKey: ['push', 'config'],
  queryFn: ({ signal }) => apiRequest('/push/config', { schema: pushConfigResponseSchema, signal }),
  staleTime: 60_000,
});

export type PushSupport = 'supported' | 'unsupported' | 'needs-install';

export function detectPushSupport(env: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  isAppleMobile: boolean;
  isStandalone: boolean;
}): PushSupport {
  if (env.hasServiceWorker && env.hasPushManager) return 'supported';
  // En iPhone/iPad solo hay Web Push si la app está añadida a la pantalla de inicio.
  if (env.isAppleMobile && !env.isStandalone) return 'needs-install';
  return 'unsupported';
}

function currentPushSupport(): PushSupport {
  return detectPushSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window && 'Notification' in window,
    isAppleMobile: /iPhone|iPad|iPod/.test(navigator.userAgent),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
  });
}

/** Clave VAPID en base64url → bytes, como pide `pushManager.subscribe`. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('sw-timeout')), 10_000),
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

const permissionDenied = () =>
  new ApiError(
    'VALIDATION_ERROR',
    'Has bloqueado las notificaciones para este sitio. Actívalas en los ajustes del navegador.',
    0,
  );

const deviceError = () =>
  new ApiError(
    'INTERNAL',
    'Este navegador no ha podido activar las notificaciones. Si estás en modo incógnito, usa una ventana normal o instala la app.',
    0,
  );

async function subscribeDevice(publicKey: string): Promise<PushSubscription> {
  try {
    const registration = await serviceWorkerRegistration();
    return (
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      }))
    );
  } catch {
    throw deviceError();
  }
}

/** Estado y acciones de los avisos push en este dispositivo. */
export function usePushNotifications() {
  const queryClient = useQueryClient();
  const config = useQuery(pushConfigQuery);
  const [support] = useState(currentPushSupport);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'denied',
  );

  useEffect(() => {
    if (support !== 'supported') return;
    let active = true;
    void serviceWorkerRegistration()
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setEndpoint(subscription?.endpoint ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [support]);

  const setConfig = useCallback(
    (next: PushConfigResponse) => queryClient.setQueryData(pushConfigQuery.queryKey, next),
    [queryClient],
  );

  const enable = useMutation({
    mutationFn: async (publicKey: string) => {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') throw permissionDenied();

      const subscription = await subscribeDevice(publicKey);
      setEndpoint(subscription.endpoint);
      return apiRequest('/push/subscriptions', {
        method: 'POST',
        body: subscription.toJSON(),
        schema: pushConfigResponseSchema,
      });
    },
    onSuccess: setConfig,
  });

  const disable = useMutation({
    mutationFn: async () => {
      const registration = await serviceWorkerRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const target = subscription?.endpoint ?? endpoint;
      await subscription?.unsubscribe();
      setEndpoint(null);
      if (!target) return null;
      return apiRequest('/push/subscriptions', {
        method: 'DELETE',
        body: { endpoint: target },
        schema: pushConfigResponseSchema,
      });
    },
    onSuccess: (next) => {
      if (next) setConfig(next);
    },
  });

  const setLeadMinutes = useMutation({
    mutationFn: (leadMinutes: LeadMinutes) =>
      apiRequest('/push/settings', {
        method: 'PUT',
        body: { leadMinutes },
        schema: pushConfigResponseSchema,
      }),
    onSuccess: setConfig,
  });

  const sendTest = useMutation({
    mutationFn: () => apiRequest('/push/test', { method: 'POST' }),
  });

  const subscribedHere = Boolean(endpoint && config.data?.endpoints.includes(endpoint));

  return { config, support, permission, subscribedHere, enable, disable, setLeadMinutes, sendTest };
}
