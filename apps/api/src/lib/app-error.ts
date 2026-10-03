import { defaultErrorMessages, type ErrorCode } from '@hrc/shared';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  CSRF_INVALID: 403,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  UPSTREAM_BLOCKED: 503,
  UPSTREAM_CHANGED: 502,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

/** Error de dominio con un mensaje seguro para mostrar al usuario. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly publicMessage: string;

  constructor(code: ErrorCode, options: { publicMessage?: string; cause?: unknown } = {}) {
    super(code, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusByCode[code];
    this.publicMessage = options.publicMessage ?? defaultErrorMessages[code];
  }
}
