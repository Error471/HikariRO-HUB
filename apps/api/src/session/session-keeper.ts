import type { FastifyBaseLogger } from 'fastify';
import type { HikariAuth } from '../hikari/hikari-auth.js';
import { AppError } from '../lib/app-error.js';
import type { SessionService } from './session-service.js';

export interface SessionKeeperOptions {
  sessions: SessionService;
  hikari: HikariAuth;
  intervalMs: number;
  logger: FastifyBaseLogger;
}

/**
 * HikariRO borra su sesión tras unos minutos sin actividad. Mientras la app esté abierta,
 * se visita la cuenta de cada sesión de vez en cuando para mantenerla viva. Si ya caducó,
 * `runDetached` intenta recuperarla (contraseña guardada) o la cierra.
 */
export class SessionKeeper {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: SessionKeeperOptions) {}

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
      for (const id of await this.options.sessions.list()) {
        await this.keepAlive(id).catch((error: unknown) => {
          this.options.logger.warn(
            { event: 'session-keeper', code: (error as { code?: string }).code ?? 'UNKNOWN' },
            'no se pudo mantener la sesión de HikariRO',
          );
        });
      }
    } finally {
      this.running = false;
    }
  }

  async keepAlive(sessionId: string): Promise<'ok' | 'gone'> {
    const { sessions, hikari } = this.options;
    const result = await sessions.runDetached(sessionId, async (jar) => {
      if ((await hikari.check(jar)) === 'anonymous') throw new AppError('SESSION_EXPIRED');
    });
    return result.status;
  }
}
