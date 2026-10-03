import type {
  LeadMinutes,
  PushConfigResponse,
  PushMessage,
  PushSubscriptionJson,
} from '@hrc/shared';
import { AppError } from '../../lib/app-error.js';
import type { UserDataStore } from '../../user/user-data-store.js';
import { isAllowedPushEndpoint, type PushSender } from './push-sender.js';

const MAX_DEVICES = 10;

export class PushService {
  constructor(
    private readonly store: UserDataStore,
    private readonly sender: PushSender | null,
  ) {}

  get enabled(): boolean {
    return this.sender !== null;
  }

  async config(username: string): Promise<PushConfigResponse> {
    const state = await this.store.getPush(username);
    return {
      enabled: this.enabled,
      publicKey: this.sender?.publicKey ?? null,
      leadMinutes: state.leadMinutes,
      endpoints: state.subscriptions.map(({ subscription }) => subscription.endpoint),
      watching: state.watchSessionId !== null,
    };
  }

  async subscribe(
    username: string,
    sessionId: string,
    subscription: PushSubscriptionJson,
  ): Promise<PushConfigResponse> {
    this.assertEnabled();
    if (!isAllowedPushEndpoint(subscription.endpoint)) {
      throw new AppError('VALIDATION_ERROR', {
        publicMessage: 'Este navegador usa un servicio de notificaciones no compatible.',
      });
    }
    const state = await this.store.getPush(username);
    const others = state.subscriptions.filter(
      (stored) => stored.subscription.endpoint !== subscription.endpoint,
    );
    state.subscriptions = [...others, { subscription, createdAt: Date.now() }].slice(-MAX_DEVICES);
    state.watchSessionId = sessionId;
    await this.store.setPush(username, state);
    return this.config(username);
  }

  async unsubscribe(username: string, endpoint: string): Promise<PushConfigResponse> {
    const state = await this.store.getPush(username);
    state.subscriptions = state.subscriptions.filter(
      ({ subscription }) => subscription.endpoint !== endpoint,
    );
    if (!state.subscriptions.length) state.watchSessionId = null;
    await this.store.setPush(username, state);
    return this.config(username);
  }

  async setLeadMinutes(username: string, leadMinutes: LeadMinutes): Promise<PushConfigResponse> {
    const state = await this.store.getPush(username);
    state.leadMinutes = leadMinutes;
    await this.store.setPush(username, state);
    return this.config(username);
  }

  /** Al iniciar sesión, la nueva sesión pasa a vigilar los respawns si hay dispositivos. */
  async sessionStarted(username: string, sessionId: string): Promise<void> {
    const state = await this.store.getPush(username);
    if (!state.subscriptions.length) return;
    state.watchSessionId = sessionId;
    await this.store.setPush(username, state);
  }

  async sessionEnded(username: string, sessionId: string): Promise<void> {
    const state = await this.store.getPush(username);
    if (state.watchSessionId !== sessionId) return;
    state.watchSessionId = null;
    await this.store.setPush(username, state);
  }

  async sendTest(username: string): Promise<number> {
    this.assertEnabled();
    return this.notify(username, {
      title: 'Avisos activados',
      body: 'Así te avisaremos cuando un MVP favorito esté a punto de salir.',
      tag: 'test',
      url: '/mvp?filter=favorites',
    });
  }

  /** Envía a todos los dispositivos del usuario y olvida los que el navegador anuló. */
  async notify(username: string, message: PushMessage): Promise<number> {
    if (!this.sender) return 0;
    const sender = this.sender;
    const state = await this.store.getPush(username);
    const results = await Promise.all(
      state.subscriptions.map(({ subscription }) => sender.send(subscription, message)),
    );
    const gone = new Set(
      state.subscriptions
        .filter((_, index) => results[index] === 'gone')
        .map(({ subscription }) => subscription.endpoint),
    );
    if (gone.size) {
      const fresh = await this.store.getPush(username);
      fresh.subscriptions = fresh.subscriptions.filter(
        ({ subscription }) => !gone.has(subscription.endpoint),
      );
      if (!fresh.subscriptions.length) fresh.watchSessionId = null;
      await this.store.setPush(username, fresh);
    }
    return results.filter((result) => result === 'sent').length;
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new AppError('NOT_FOUND', {
        publicMessage: 'Los avisos no están configurados en este servidor.',
      });
    }
  }
}
