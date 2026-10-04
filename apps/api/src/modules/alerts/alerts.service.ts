import type { AlertConfigResponse, AlertMessage, AlertSettings } from '@hikari-hub/shared';
import { AppError } from '../../lib/app-error.js';
import type { UserDataStore } from '../../user/user-data-store.js';
import type { Notifier } from './notifier.js';

export class AlertService {
  constructor(
    private readonly store: UserDataStore,
    private readonly notifier: Notifier | null,
  ) {}

  get available(): boolean {
    return this.notifier !== null;
  }

  async config(username: string): Promise<AlertConfigResponse> {
    const state = await this.store.getAlerts(username);
    return {
      available: this.available,
      enabled: state.enabled,
      leadMinutes: state.leadMinutes,
      watching: state.enabled && state.watchSessionId !== null,
    };
  }

  /** Activar los avisos hace que esta sesión sea la que vigila los respawns. */
  async update(
    username: string,
    sessionId: string,
    settings: AlertSettings,
  ): Promise<AlertConfigResponse> {
    if (settings.enabled) this.assertAvailable();
    const state = await this.store.getAlerts(username);
    if (settings.leadMinutes !== undefined) state.leadMinutes = settings.leadMinutes;
    if (settings.enabled !== undefined) {
      state.enabled = settings.enabled;
      state.watchSessionId = settings.enabled ? sessionId : null;
    }
    await this.store.setAlerts(username, state);
    return this.config(username);
  }

  /** Al iniciar sesión, la nueva sesión pasa a vigilar los respawns si los avisos están activos. */
  async sessionStarted(username: string, sessionId: string): Promise<void> {
    const state = await this.store.getAlerts(username);
    if (!state.enabled) return;
    state.watchSessionId = sessionId;
    await this.store.setAlerts(username, state);
  }

  async sessionEnded(username: string, sessionId: string): Promise<void> {
    const state = await this.store.getAlerts(username);
    if (state.watchSessionId !== sessionId) return;
    state.watchSessionId = null;
    await this.store.setAlerts(username, state);
  }

  async sendTest(): Promise<boolean> {
    this.assertAvailable();
    return this.notify({
      title: 'Avisos activados',
      body: 'Así te avisaremos cuando un MVP favorito esté a punto de salir.',
      tag: 'test',
      url: '/mvp?filter=favorites',
    });
  }

  notify(message: AlertMessage): Promise<boolean> {
    return this.notifier ? this.notifier.notify(message) : Promise.resolve(false);
  }

  private assertAvailable(): void {
    if (!this.available) {
      throw new AppError('NOT_FOUND', {
        publicMessage: 'Los avisos solo funcionan en la app de escritorio de Hikari Hub.',
      });
    }
  }
}
