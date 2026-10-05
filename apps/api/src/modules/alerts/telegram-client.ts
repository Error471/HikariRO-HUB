import { request, type Dispatcher } from 'undici';
import { AppError } from '../../lib/app-error.js';

export interface TelegramClientOptions {
  baseUrl: string;
  timeoutMs: number;
  dispatcher?: Dispatcher;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: { chat?: { id?: number | string } };
  my_chat_member?: { chat?: { id?: number | string } };
}

/**
 * Cliente mínimo de la API de bots de Telegram. El token va en la URL, así que nunca se
 * incluye en errores ni en logs: solo se propagan códigos y mensajes para el usuario.
 */
export class TelegramClient {
  constructor(private readonly options: TelegramClientOptions) {}

  /** Comprueba el token y devuelve el @usuario del bot. */
  async botName(token: string): Promise<string> {
    const me = await this.call<{ username?: string }>(token, 'getMe');
    return me.username ? `@${me.username}` : 'tu bot';
  }

  /** Chat del último mensaje recibido por el bot (el usuario le escribió /start). */
  async latestChatId(token: string): Promise<string | null> {
    const updates = await this.call<TelegramUpdate[]>(token, 'getUpdates', {
      allowed_updates: ['message', 'my_chat_member'],
    });
    for (const update of [...updates].reverse()) {
      const id = update.message?.chat?.id ?? update.my_chat_member?.chat?.id;
      if (id !== undefined) return String(id);
    }
    return null;
  }

  async sendMessage(token: string, chatId: string, text: string): Promise<void> {
    await this.call(token, 'sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
  }

  private async call<T>(token: string, method: string, body: object = {}): Promise<T> {
    let data: TelegramResponse<T>;
    try {
      const response = await request(`${this.options.baseUrl}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        dispatcher: this.options.dispatcher,
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      data = (await response.body.json()) as TelegramResponse<T>;
    } catch {
      throw new AppError('UPSTREAM_UNAVAILABLE', {
        publicMessage: 'No se ha podido conectar con Telegram. Inténtalo de nuevo.',
      });
    }
    if (data.ok && data.result !== undefined) return data.result;
    throw telegramError(data.error_code);
  }
}

function telegramError(code: number | undefined): AppError {
  if (code === 401 || code === 404) {
    return new AppError('VALIDATION_ERROR', {
      publicMessage: 'Telegram no reconoce el token del bot. Cópialo de nuevo desde @BotFather.',
    });
  }
  if (code === 403) {
    return new AppError('VALIDATION_ERROR', {
      publicMessage: 'El bot no puede escribirte: abre el chat con el bot y pulsa Iniciar.',
    });
  }
  if (code === 400) {
    return new AppError('VALIDATION_ERROR', {
      publicMessage: 'Telegram no encuentra ese chat. Vuelve a vincularlo.',
    });
  }
  if (code === 409) {
    return new AppError('VALIDATION_ERROR', {
      publicMessage:
        'Ese bot está conectado a otro servicio (webhook). Usa un bot solo para Hikari Hub.',
    });
  }
  return new AppError('UPSTREAM_UNAVAILABLE', {
    publicMessage: 'Telegram no ha respondido. Inténtalo de nuevo en un momento.',
  });
}
