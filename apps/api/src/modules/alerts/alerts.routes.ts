import {
  alertSettingsSchema,
  alertTestSchema,
  mvpAlertChannelSchema,
  telegramChatSchema,
  telegramTokenSchema,
} from '@hikari-hub/shared';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../lib/app-error.js';
import type { AlertService } from './alerts.service.js';

export interface AlertRoutesOptions {
  alerts: AlertService;
  requireSession: preHandlerAsyncHookHandler;
}

const mvpParamsSchema = z.object({ mvpId: z.coerce.number().int().positive() });

function currentSession(request: FastifyRequest) {
  if (!request.session) throw new AppError('UNAUTHENTICATED');
  return { username: request.session.record.username, sessionId: request.session.id };
}

export async function alertRoutes(app: FastifyInstance, options: AlertRoutesOptions) {
  const { alerts, requireSession } = options;
  const opts = { preHandler: requireSession };
  // Las rutas que hablan con Telegram tienen un límite propio.
  const telegramOpts = { ...opts, config: { rateLimit: { max: 10, timeWindow: 60_000 } } };

  app.get('/config', opts, async (request) => alerts.config(currentSession(request).username));

  app.put('/settings', opts, async (request) => {
    const { username, sessionId } = currentSession(request);
    return alerts.update(username, sessionId, alertSettingsSchema.parse(request.body));
  });

  app.put('/mvps/:mvpId', opts, async (request) => {
    const { username, sessionId } = currentSession(request);
    const { mvpId } = mvpParamsSchema.parse(request.params);
    const { channel } = mvpAlertChannelSchema.parse(request.body);
    return alerts.setMvpChannel(username, sessionId, mvpId, channel);
  });

  app.put('/telegram', telegramOpts, async (request) => {
    const { username, sessionId } = currentSession(request);
    const { botToken } = telegramTokenSchema.parse(request.body);
    return alerts.connectTelegram(username, sessionId, botToken);
  });

  app.post('/telegram/detect', telegramOpts, async (request) => {
    const { username, sessionId } = currentSession(request);
    return alerts.detectTelegramChat(username, sessionId);
  });

  app.put('/telegram/chat', telegramOpts, async (request) => {
    const { username, sessionId } = currentSession(request);
    const { chatId } = telegramChatSchema.parse(request.body);
    return alerts.linkTelegramChat(username, sessionId, chatId);
  });

  app.delete('/telegram', opts, async (request) => {
    const { username, sessionId } = currentSession(request);
    return alerts.disconnectTelegram(username, sessionId);
  });

  app.post(
    '/test',
    { ...opts, config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
    async (request) => {
      const { username } = currentSession(request);
      const { channel } = alertTestSchema.parse(request.body);
      return { sent: await alerts.sendTest(username, channel) };
    },
  );
}
