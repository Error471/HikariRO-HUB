import type { DiagnosticsResponse } from '@hikari-hub/shared';
import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { arch, release, type } from 'node:os';
import type { UpstreamMonitor } from '../../hikari/upstream-monitor.js';
import type { ErrorJournal } from '../../lib/error-journal.js';

export interface DiagnosticsRoutesOptions {
  version: string;
  startedAt: Date;
  monitor: UpstreamMonitor;
  journal: ErrorJournal;
  requireSession: preHandlerAsyncHookHandler;
}

/** Estado de HikariRO y errores recientes, para ayudar a diagnosticar problemas. */
export async function diagnosticsRoutes(app: FastifyInstance, options: DiagnosticsRoutesOptions) {
  app.get('/', { preHandler: options.requireSession }, async (): Promise<DiagnosticsResponse> => ({
    version: options.version,
    platform: `${type()} ${release()} (${arch()})`,
    startedAt: options.startedAt.toISOString(),
    modules: options.monitor.snapshot(),
    entries: options.journal.list(),
  }));

  app.delete('/entries', { preHandler: options.requireSession }, async (_request, reply) => {
    options.journal.clear();
    return reply.status(204).send();
  });
}
