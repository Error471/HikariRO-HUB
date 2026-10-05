import type {
  AlertChannel,
  AlertConfigResponse,
  AlertMessage,
  AlertSettings,
} from '@hikari-hub/shared';
import { AppError } from '../../lib/app-error.js';
import type { Sealer } from '../../lib/crypto.js';
import type { AlertState, UserDataStore } from '../../user/user-data-store.js';
import type { Notifier } from './notifier.js';
import type { TelegramClient } from './telegram-client.js';

export type DeliveryChannel = 'windows' | 'telegram';

const includes = (channel: AlertChannel, target: DeliveryChannel) =>
  channel === 'both' || channel === target;

export class AlertService {
  constructor(
    private readonly store: UserDataStore,
    private readonly notifier: Notifier | null,
    private readonly telegram: TelegramClient,
    private readonly sealer: Sealer,
  ) {}

  /** Notificaciones de Windows: solo en la app de escritorio. */
  get windowsAvailable(): boolean {
    return this.notifier !== null;
  }

  async config(username: string): Promise<AlertConfigResponse> {
    return this.toResponse(await this.store.getAlerts(username));
  }

  /** Cualquier cambio del usuario hace que su sesión actual sea la que vigila los respawns. */
  async update(
    username: string,
    sessionId: string,
    settings: AlertSettings,
  ): Promise<AlertConfigResponse> {
    return this.mutate(username, sessionId, (state) => {
      if (settings.leadMinutes !== undefined) state.leadMinutes = settings.leadMinutes;
      if (settings.enabled !== undefined) state.enabled = settings.enabled;
    });
  }

  async setMvpChannel(
    username: string,
    sessionId: string,
    mvpId: number,
    channel: AlertChannel | 'none',
  ): Promise<AlertConfigResponse> {
    return this.mutate(username, sessionId, (state) => {
      const key = String(mvpId);
      if (channel === 'none') {
        state.channels = Object.fromEntries(
          Object.entries(state.channels).filter(([id]) => id !== key),
        );
        return;
      }
      state.channels[key] = channel;
      // Marcar un MVP es la forma de pedir avisos: se reanudan si estaban en pausa.
      state.enabled = true;
    });
  }

  // --- Telegram ---

  async connectTelegram(
    username: string,
    sessionId: string,
    botToken: string,
  ): Promise<AlertConfigResponse> {
    const botName = await this.telegram.botName(botToken);
    return this.mutate(username, sessionId, (state) => {
      state.telegram = { token: this.sealer.seal(botToken), botName, chatId: null };
    });
  }

  /** Busca el chat del último mensaje enviado al bot y confirma la vinculación por Telegram. */
  async detectTelegramChat(username: string, sessionId: string): Promise<AlertConfigResponse> {
    const token = await this.telegramToken(username);
    const chatId = await this.telegram.latestChatId(token);
    if (!chatId) {
      throw new AppError('VALIDATION_ERROR', {
        publicMessage:
          'Todavía no hay ningún mensaje: abre el chat con tu bot, pulsa Iniciar y vuelve a probar.',
      });
    }
    return this.linkTelegramChat(username, sessionId, chatId);
  }

  async linkTelegramChat(
    username: string,
    sessionId: string,
    chatId: string,
  ): Promise<AlertConfigResponse> {
    const token = await this.telegramToken(username);
    await this.telegram.sendMessage(
      token,
      chatId,
      'Hikari Hub vinculado. Aquí recibirás los avisos de los MVPs que marques con Telegram.',
    );
    return this.mutate(username, sessionId, (state) => {
      if (state.telegram) state.telegram.chatId = chatId;
    });
  }

  async disconnectTelegram(username: string, sessionId: string): Promise<AlertConfigResponse> {
    return this.mutate(username, sessionId, (state) => {
      state.telegram = null;
    });
  }

  // --- Sesión del vigilante ---

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

  // --- Envío ---

  async sendTest(username: string, channel: DeliveryChannel): Promise<boolean> {
    const message: AlertMessage = {
      title: 'Aviso de prueba',
      body: 'Así te avisaremos cuando un MVP marcado esté a punto de salir.',
      tag: 'test',
      url: '/mvp',
    };
    if (channel === 'windows') {
      if (!this.notifier) {
        throw new AppError('NOT_FOUND', {
          publicMessage: 'Las notificaciones de Windows solo funcionan en la app de escritorio.',
        });
      }
      return this.notifier.notify(message);
    }
    const state = await this.store.getAlerts(username);
    if (!state.telegram?.chatId) {
      throw new AppError('VALIDATION_ERROR', {
        publicMessage: 'Primero conecta tu bot y vincula el chat de Telegram.',
      });
    }
    await this.telegram.sendMessage(
      this.unseal(state.telegram.token),
      state.telegram.chatId,
      formatText(message),
    );
    return true;
  }

  /** Envía el aviso por los canales elegidos; devuelve cuántos lo entregaron. */
  async deliver(username: string, channel: AlertChannel, message: AlertMessage): Promise<number> {
    const state = await this.store.getAlerts(username);
    let delivered = 0;
    if (includes(channel, 'windows') && this.notifier && (await this.notifier.notify(message))) {
      delivered += 1;
    }
    if (includes(channel, 'telegram') && state.telegram?.chatId) {
      await this.telegram.sendMessage(
        this.unseal(state.telegram.token),
        state.telegram.chatId,
        formatText(message),
      );
      delivered += 1;
    }
    return delivered;
  }

  /** Avisos generales (p. ej. sesión caducada): por todos los canales que use el usuario. */
  async deliverToAll(username: string, message: AlertMessage): Promise<number> {
    const state = await this.store.getAlerts(username);
    const used = Object.values(state.channels);
    const wantsWindows = used.some((channel) => includes(channel, 'windows'));
    const wantsTelegram = used.some((channel) => includes(channel, 'telegram'));
    const channel: AlertChannel =
      wantsWindows && wantsTelegram ? 'both' : wantsTelegram ? 'telegram' : 'windows';
    return this.deliver(username, channel, message).catch(() => 0);
  }

  // --- Internos ---

  private async mutate(
    username: string,
    sessionId: string,
    change: (state: AlertState) => void,
  ): Promise<AlertConfigResponse> {
    const state = await this.store.getAlerts(username);
    change(state);
    state.watchSessionId = state.enabled ? sessionId : null;
    await this.store.setAlerts(username, state);
    return this.toResponse(state);
  }

  private async telegramToken(username: string): Promise<string> {
    const state = await this.store.getAlerts(username);
    if (!state.telegram) {
      throw new AppError('VALIDATION_ERROR', {
        publicMessage: 'Primero conecta tu bot de Telegram.',
      });
    }
    return this.unseal(state.telegram.token);
  }

  private unseal(sealed: string): string {
    try {
      return this.sealer.unseal(sealed);
    } catch {
      throw new AppError('VALIDATION_ERROR', {
        publicMessage: 'No se pudo leer el token del bot. Conéctalo de nuevo.',
      });
    }
  }

  private toResponse(state: AlertState): AlertConfigResponse {
    return {
      windowsAvailable: this.windowsAvailable,
      enabled: state.enabled,
      leadMinutes: state.leadMinutes,
      watching: state.enabled && state.watchSessionId !== null,
      channels: state.channels,
      telegram: {
        configured: state.telegram !== null,
        botName: state.telegram?.botName ?? null,
        chatLinked: Boolean(state.telegram?.chatId),
      },
    };
  }
}

/** Texto plano para Telegram: sin formato, así no hay nada que escapar. */
function formatText(message: AlertMessage): string {
  return `🔔 ${message.title}\n${message.body}`;
}
