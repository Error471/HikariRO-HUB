import {
  apiErrorBodySchema,
  CSRF_HEADER,
  defaultErrorMessages,
  type ErrorCode,
} from '@hikari-hub/shared';
import type { z } from 'zod';

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_MESSAGE =
  'No se ha podido conectar con Hikari Hub. Comprueba tu conexión e inténtalo nuevamente.';

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

const SAFE_METHODS = new Set(['GET', 'HEAD']);

interface RequestOptions<TSchema extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  schema?: TSchema;
  signal?: AbortSignal;
}

export async function apiRequest<TSchema extends z.ZodType>(
  path: string,
  options: RequestOptions<TSchema> = {},
): Promise<z.infer<TSchema>> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (!SAFE_METHODS.has(method) && csrfToken) headers[CSRF_HEADER] = csrfToken;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('NETWORK_ERROR', NETWORK_MESSAGE, 0);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204 || !options.schema) return undefined as z.infer<TSchema>;

  const parsed = options.schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiError('INTERNAL', defaultErrorMessages.INTERNAL, response.status);
  }
  return parsed.data;
}

async function toApiError(response: Response): Promise<ApiError> {
  const parsed = apiErrorBodySchema.safeParse(await response.json().catch(() => null));
  if (parsed.success) {
    return new ApiError(parsed.data.error.code, parsed.data.error.message, response.status);
  }
  return new ApiError('INTERNAL', defaultErrorMessages.INTERNAL, response.status);
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : defaultErrorMessages.INTERNAL;
}
