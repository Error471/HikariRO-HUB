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

export const alertConfigResponseSchema = z.object({
  /** `false` fuera de la app de escritorio: no hay a quién enviar las notificaciones. */
  available: z.boolean(),
  enabled: z.boolean(),
  leadMinutes: leadMinutesSchema,
  /** `false` si la sesión que vigila los respawns caducó y hay que volver a entrar. */
  watching: z.boolean(),
});
export type AlertConfigResponse = z.infer<typeof alertConfigResponseSchema>;

/** Contenido de cada notificación de Windows. */
export const alertMessageSchema = z.object({
  title: z.string(),
  body: z.string(),
  tag: z.string(),
  url: z.string(),
});
export type AlertMessage = z.infer<typeof alertMessageSchema>;
