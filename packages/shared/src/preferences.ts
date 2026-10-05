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

export const alertSettingsSchema = z
  .object({ enabled: z.boolean().optional(), leadMinutes: leadMinutesSchema.optional() })
  .refine((value) => value.enabled !== undefined || value.leadMinutes !== undefined, {
    message: 'No hay nada que cambiar',
  });
export type AlertSettings = z.infer<typeof alertSettingsSchema>;

/** Por dónde avisar de un MVP. Sin entrada = sin avisos. */
export const alertChannelSchema = z.enum(['windows', 'telegram', 'both']);
export type AlertChannel = z.infer<typeof alertChannelSchema>;

export const mvpAlertChannelSchema = z.object({
  channel: z.union([alertChannelSchema, z.literal('none')]),
});
export type MvpAlertChannel = z.infer<typeof mvpAlertChannelSchema>;

/** Token que da @BotFather: `123456789:AA…`. */
export const telegramTokenSchema = z.object({
  botToken: z
    .string()
    .trim()
    .regex(/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/, 'El token no tiene el formato de @BotFather.'),
});

/** Chat de Telegram: número (negativo en grupos) o @canal. */
export const telegramChatSchema = z.object({
  chatId: z
    .string()
    .trim()
    .regex(/^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/, 'El chat debe ser un número o un @canal.'),
});

export const alertTestSchema = z.object({ channel: z.enum(['windows', 'telegram']) });

export const alertConfigResponseSchema = z.object({
  /** `false` fuera de la app de escritorio: no hay notificaciones de Windows. */
  windowsAvailable: z.boolean(),
  /** Interruptor general: en pausa no se envía ningún aviso. */
  enabled: z.boolean(),
  leadMinutes: leadMinutesSchema,
  /** `false` si la sesión que vigila los respawns caducó y hay que volver a entrar. */
  watching: z.boolean(),
  /** Canal elegido para cada MVP (id → canal). Los que no aparecen no avisan. */
  channels: z.record(z.string(), alertChannelSchema),
  telegram: z.object({
    /** Hay un bot guardado (el token nunca sale de la app). */
    configured: z.boolean(),
    botName: z.string().nullable(),
    chatLinked: z.boolean(),
  }),
});
export type AlertConfigResponse = z.infer<typeof alertConfigResponseSchema>;

/** Contenido de cada aviso (notificación de Windows o mensaje de Telegram). */
export const alertMessageSchema = z.object({
  title: z.string(),
  body: z.string(),
  tag: z.string(),
  url: z.string(),
});
export type AlertMessage = z.infer<typeof alertMessageSchema>;
