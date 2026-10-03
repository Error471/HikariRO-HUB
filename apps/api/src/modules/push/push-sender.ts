import type { PushMessage, PushSubscriptionJson } from '@hrc/shared';
import webpush from 'web-push';

export type PushResult = 'sent' | 'gone' | 'failed';

export interface PushSender {
  readonly publicKey: string;
  send(subscription: PushSubscriptionJson, message: PushMessage): Promise<PushResult>;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Servicios de push de los navegadores. El servidor hace POST al `endpoint` que manda el
 * cliente, así que solo se aceptan estos hosts para no abrir la puerta a SSRF.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}

export class WebPushSender implements PushSender {
  readonly publicKey: string;

  constructor(private readonly vapid: VapidConfig) {
    this.publicKey = vapid.publicKey;
  }

  async send(subscription: PushSubscriptionJson, message: PushMessage): Promise<PushResult> {
    if (!isAllowedPushEndpoint(subscription.endpoint)) return 'gone';
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        JSON.stringify(message),
        {
          vapidDetails: this.vapid,
          TTL: 15 * 60,
          urgency: 'high',
          timeout: 10_000,
          topic: message.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
        },
      );
      return 'sent';
    } catch (error) {
      // 404/410: el navegador anuló la suscripción.
      const status = (error as { statusCode?: number }).statusCode;
      return status === 404 || status === 410 ? 'gone' : 'failed';
    }
  }
}
