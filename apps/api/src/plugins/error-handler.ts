import type { ApiErrorBody, ErrorCode } from '@hrc/shared';
import { defaultErrorMessages } from '@hrc/shared';
import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/app-error.js';

function sendError(reply: FastifyReply, status: number, code: ErrorCode, message?: string) {
  const body: ApiErrorBody = { error: { code, message: message ?? defaultErrorMessages[code] } };
  return reply.status(status).send(body);
}

/** Normaliza todas las respuestas de error: nunca se exponen mensajes internos ni stack traces. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError | ZodError, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.warn({ code: error.code, cause: describeCause(error.cause) }, 'upstream error');
      }
      return sendError(reply, error.statusCode, error.code, error.publicMessage);
    }
    if (error instanceof ZodError) {
      return sendError(reply, 422, 'VALIDATION_ERROR', error.issues[0]?.message);
    }
    if (error.statusCode === 429) return sendError(reply, 429, 'RATE_LIMITED');
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return sendError(reply, error.statusCode, 'VALIDATION_ERROR');
    }
    request.log.error({ err: error }, 'unhandled error');
    return sendError(reply, 500, 'INTERNAL');
  });

  app.setNotFoundHandler((_request, reply) => sendError(reply, 404, 'NOT_FOUND'));
}

function describeCause(cause: unknown): string | undefined {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  return undefined;
}
