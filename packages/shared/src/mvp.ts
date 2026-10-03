import { z } from 'zod';

export const mvpSpawnSchema = z.object({
  map: z.string(),
  /** Epoch en segundos (hora del servidor). `null` = sin muerte registrada. */
  killedAt: z.number().nullable(),
  minAt: z.number().nullable(),
  maxAt: z.number().nullable(),
});
export type MvpSpawn = z.infer<typeof mvpSpawnSchema>;

export const mvpSchema = z.object({
  id: z.number(),
  name: z.string(),
  imageUrl: z.string(),
  detailUrl: z.string(),
  spawns: z.array(mvpSpawnSchema),
});
export type Mvp = z.infer<typeof mvpSchema>;

export const mvpListResponseSchema = z.object({
  /** Epoch en segundos según el reloj de HikariRO, para corregir el desfase del cliente. */
  serverNow: z.number(),
  mvps: z.array(mvpSchema),
});
export type MvpListResponse = z.infer<typeof mvpListResponseSchema>;
