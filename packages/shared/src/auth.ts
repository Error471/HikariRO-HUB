import { z } from 'zod';

export const loginRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Introduce tu usuario.')
    .max(32, 'El usuario es demasiado largo.'),
  password: z
    .string()
    .min(1, 'Introduce tu contraseña.')
    .max(64, 'La contraseña es demasiado larga.'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionUserSchema = z.object({
  username: z.string(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({
  user: sessionUserSchema,
  csrfToken: z.string(),
  expiresAt: z.string(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const CSRF_HEADER = 'x-csrf-token';

export const publicInfoSchema = z.object({ privacyContact: z.string().nullable() });
export type PublicInfo = z.infer<typeof publicInfoSchema>;
