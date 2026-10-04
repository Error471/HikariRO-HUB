import { alertSettingsSchema } from '@hikari-hub/shared';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { AlertService } from './alerts.service.js';

export interface AlertRoutesOptions {
  alerts: AlertService;
  requireSession: preHandlerAsyncHookHandler;
}

function currentSession(request: FastifyRequest) {
  if (!request.session) throw new AppError('UNAUTHENTICATED');
  return request.session;
}

export async function alertRoutes(app: FastifyInstance, options: AlertRoutesOptions) {
  const { alerts, requireSession } = options;
  const opts = { preHandler: requireSession };

  app.get('/config', opts, async (request) =>
    alerts.config(currentSession(request).record.username),
  );

  app.put('/settings', opts, async (request) => {
    const session = currentSession(request);
    const settings = alertSettingsSchema.parse(request.body);
    return alerts.update(session.record.username, session.id, settings);
  });

  app.post(
    '/test',
    { ...opts, config: { rateLimit: { max: 3, timeWindow: 60_000 } } },
    async (request) => {
      currentSession(request);
      return { sent: await alerts.sendTest() };
    },
  );
}
