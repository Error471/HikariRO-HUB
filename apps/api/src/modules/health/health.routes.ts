import type { PublicInfo } from '@hrc/shared';
import type { FastifyInstance } from 'fastify';

export interface HealthRoutesOptions {
  privacyContact?: string;
}

export async function healthRoutes(app: FastifyInstance, options: HealthRoutesOptions) {
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));

  // Información pública de la instancia (página de privacidad).
  app.get('/info', async (): Promise<PublicInfo> => ({
    privacyContact: options.privacyContact || null,
  }));
}
