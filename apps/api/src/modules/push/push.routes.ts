import { pushSettingsSchema, pushSubscriptionSchema, pushUnsubscribeSchema } from '@hrc/shared';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { AppError } from '../../lib/app-error.js';
import type { PushService } from './push.service.js';

export interface PushRoutesOptions {
  push: PushService;
  requireSession: preHandlerAsyncHookHandler;
}

function currentSession(request: FastifyRequest) {
  if (!request.session) throw new AppError('UNAUTHENTICATED');
  return request.session;
}

export async function pushRoutes(app: FastifyInstance, options: PushRoutesOptions) {
  const { push, requireSession } = options;
  const opts = { preHandler: requireSession };

  app.get('/config', opts, async (request) => push.config(currentSession(request).record.username));

  app.post(
    '/subscriptions',
    { ...opts, config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
    async (request) => {
      const session = currentSession(request);
      const subscription = pushSubscriptionSchema.parse(request.body);
      return push.subscribe(session.record.username, session.id, subscription);
    },
  );

  app.delete('/subscriptions', opts, async (request) => {
    const { endpoint } = pushUnsubscribeSchema.parse(request.body);
    return push.unsubscribe(currentSession(request).record.username, endpoint);
  });

  app.put('/settings', opts, async (request) => {
    const { leadMinutes } = pushSettingsSchema.parse(request.body);
    return push.setLeadMinutes(currentSession(request).record.username, leadMinutes);
  });

  app.post(
    '/test',
    { ...opts, config: { rateLimit: { max: 3, timeWindow: 60_000 } } },
    async (request) => ({ sent: await push.sendTest(currentSession(request).record.username) }),
  );
}
