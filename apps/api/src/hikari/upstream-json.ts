import type { z } from 'zod';
import { AppError } from '../lib/app-error.js';
import { isLoginRedirect } from './fluxcp-pages.js';
import type { HikariResponse } from './hikari-client.js';

/**
 * Valida una respuesta JSON de HikariRO. Una redirección al login o una página HTML
 * con formulario de login significan que la sesión ha caducado.
 */
export function parseUpstreamJson<TSchema extends z.ZodType>(
  response: HikariResponse,
  schema: TSchema,
): z.infer<TSchema> {
  if (isLoginRedirect(response)) throw new AppError('SESSION_EXPIRED');
  if (response.status !== 200) throw new AppError('UPSTREAM_UNAVAILABLE');

  if (!response.contentType.includes('json')) {
    if (/name=["']password["']/i.test(response.body)) throw new AppError('SESSION_EXPIRED');
    throw new AppError('UPSTREAM_CHANGED');
  }

  let data: unknown;
  try {
    data = JSON.parse(response.body);
  } catch (error) {
    throw new AppError('UPSTREAM_CHANGED', { cause: error });
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError('UPSTREAM_CHANGED', { cause: parsed.error });
  return parsed.data;
}
