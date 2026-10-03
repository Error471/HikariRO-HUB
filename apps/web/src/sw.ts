/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

// ─── Precache de la app (la API nunca se cachea) ───────────────────────────
const manifest = self.__WB_MANIFEST;
precacheAndRoute(manifest);
cleanupOutdatedCaches();
clientsClaim();

const precached = (url: string) =>
  manifest.some((entry) => (typeof entry === 'string' ? entry : entry.url) === url);

if (precached('index.html')) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
  );
}

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// ─── Avisos push ───────────────────────────────────────────────────────────
interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

function readPayload(event: PushEvent): PushPayload | null {
  try {
    const data = event.data?.json() as Partial<PushPayload> | undefined;
    if (typeof data?.title !== 'string' || typeof data.body !== 'string') return null;
    return {
      title: data.title,
      body: data.body,
      tag: typeof data.tag === 'string' ? data.tag : 'hrc',
      url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/',
    };
  } catch {
    return null;
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event);
  if (!payload) return;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      lang: 'es',
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data as { url?: string } | null)?.url ?? '/';
  const target = new URL(path.startsWith('/') ? path : '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.focus();
        await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
