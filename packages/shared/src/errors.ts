import { z } from 'zod';

export const errorCodes = [
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'CSRF_INVALID',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_BLOCKED',
  'UPSTREAM_CHANGED',
  'NOT_FOUND',
  'INTERNAL',
] as const;

export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** Mensajes visibles para el usuario. Nunca incluyen detalles internos. */
export const defaultErrorMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Revisa los datos introducidos.',
  INVALID_CREDENTIALS: 'Usuario o contraseña incorrectos.',
  UNAUTHENTICATED: 'Necesitas iniciar sesión para continuar.',
  SESSION_EXPIRED: 'Tu sesión ha expirado.',
  CSRF_INVALID: 'La petición no es válida. Recarga la página e inténtalo de nuevo.',
  RATE_LIMITED: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  UPSTREAM_UNAVAILABLE:
    'No se ha podido conectar con HikariRO. Comprueba tu conexión e inténtalo nuevamente.',
  UPSTREAM_BLOCKED:
    'HikariRO ha rechazado temporalmente la conexión. Inténtalo de nuevo más tarde.',
  UPSTREAM_CHANGED:
    'HikariRO ha cambiado y esta sección no puede mostrarse ahora mismo. Ya estamos en ello.',
  NOT_FOUND: 'No se ha encontrado lo que buscabas.',
  INTERNAL: 'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
};
