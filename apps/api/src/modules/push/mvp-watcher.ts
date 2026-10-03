import type { FastifyBaseLogger } from 'fastify';
import type { SessionService } from '../../session/session-service.js';
import type { UserDataStore } from '../../user/user-data-store.js';
import type { MvpService } from '../mvp/mvp.service.js';
import { dueAlerts } from './mvp-alerts.js';
import type { PushService } from './push.service.js';

export interface MvpWatcherOptions {
  store: UserDataStore;
  sessions: SessionService;
  mvp: MvpService;
  push: PushService;
  intervalMs: number;
  logger: FastifyBaseLogger;
}

const CLAIM_TTL_SECONDS = 86_400;

/** Consulta periódicamente el MVP Timer por cada usuario con avisos y envía los que tocan. */
export class MvpWatcher {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: MvpWatcherOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const username of await this.options.store.pushUsers()) {
        await this.checkUser(username).catch((error: unknown) => {
          this.options.logger.warn(
            { event: 'mvp-watcher', code: (error as { code?: string }).code ?? 'UNKNOWN' },
            'no se pudieron comprobar los MVPs',
          );
        });
      }
    } finally {
      this.running = false;
    }
  }

  async checkUser(username: string): Promise<number> {
    const { store, sessions, mvp, push, intervalMs } = this.options;
    const state = await store.getPush(username);
    if (!state.watchSessionId) return 0;
    const favorites = new Set(await store.getFavorites(username));
    if (!favorites.size) return 0;

    const result = await sessions.runDetached(state.watchSessionId, (jar) =>
      mvp.list(username, jar),
    );
    if (result.status === 'gone') {
      await push.sessionEnded(username, state.watchSessionId);
      await push.notify(username, {
        title: 'Avisos de MVP en pausa',
        body: 'Tu sesión ha caducado. Entra de nuevo en el Companion para reactivarlos.',
        tag: 'session-expired',
        url: '/',
      });
      return 0;
    }

    const alerts = dueAlerts({
      data: result.value,
      favorites,
      leadMinutes: state.leadMinutes,
      graceSeconds: Math.max(180, (intervalMs / 1000) * 3),
    });
    let sent = 0;
    for (const alert of alerts) {
      if (
        await store.claimNotification(`${username.toLowerCase()}:${alert.key}`, CLAIM_TTL_SECONDS)
      ) {
        sent += await push.notify(username, alert.message);
      }
    }
    return sent;
  }
}
