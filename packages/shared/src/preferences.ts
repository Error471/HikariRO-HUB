import { z } from 'zod';

export const MAX_FAVORITES = 300;

export const favoritesSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .max(MAX_FAVORITES)
    .transform((ids) => [...new Set(ids)]),
});
export type Favorites = z.infer<typeof favoritesSchema>;

/** Minutos de antelación del aviso; 0 = solo cuando se abre la ventana de respawn. */
export const leadMinutesSchema = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(10),
  z.literal(15),
]);
export type LeadMinutes = z.infer<typeof leadMinutesSchema>;

export const pushSettingsSchema = z.object({ leadMinutes: leadMinutesSchema });
export type PushSettings = z.infer<typeof pushSettingsSchema>;

/** Formato de `PushSubscription.toJSON()` en el navegador. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1024),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(64),
  }),
});
export type PushSubscriptionJson = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(1024) });

export const pushConfigResponseSchema = z.object({
  /** `false` si el servidor no tiene claves VAPID configuradas. */
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
  leadMinutes: leadMinutesSchema,
  /** Endpoints registrados por este usuario (para saber si este navegador está suscrito). */
  endpoints: z.array(z.string()),
  /** `false` si la sesión que vigila los respawns caducó y hay que volver a entrar. */
  watching: z.boolean(),
});
export type PushConfigResponse = z.infer<typeof pushConfigResponseSchema>;

/** Contenido de cada notificación push (lo lee el service worker). */
export const pushMessageSchema = z.object({
  title: z.string(),
  body: z.string(),
  tag: z.string(),
  url: z.string(),
});
export type PushMessage = z.infer<typeof pushMessageSchema>;
