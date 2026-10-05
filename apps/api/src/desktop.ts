import { loadEnv } from './config/env.js';
import type { Notifier } from './modules/alerts/notifier.js';
import { startServer, type RunningServer } from './runtime.js';

export type { Notifier } from './modules/alerts/notifier.js';
export type { AlertMessage } from '@hikari-hub/shared';

export interface DesktopServerOptions {
  /** Carpeta de datos del usuario (sesiones, favoritos, avisos). */
  dataDir: string;
  /** Build de la web. */
  webDir: string;
  logFile: string;
  notifier: Notifier;
  /** Secretos generados en el primer arranque y guardados cifrados por Windows. */
  sessionSecret: string;
  encryptionKey: string;
  /** Puertos a probar en orden; uno fijo conserva el estado guardado por el navegador. */
  ports: number[];
  version: string;
  /** Solo para pruebas (mock de HikariRO). */
  hikariBaseUrl?: string;
  newsFeedUrl?: string;
}

export interface DesktopServer extends RunningServer {
  url: string;
}

/** API + web en 127.0.0.1, solo accesible desde este PC. */
export async function startDesktopServer(options: DesktopServerOptions): Promise<DesktopServer> {
  for (const port of options.ports) {
    const url = `http://127.0.0.1:${port}`;
    const env = loadEnv({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      LOG_LEVEL: 'warn',
      APP_VERSION: options.version,
      LOG_FILE: options.logFile,
      APP_ORIGIN: url,
      DATA_DIR: options.dataDir,
      WEB_DIST_DIR: options.webDir,
      SESSION_SECRET: options.sessionSecret,
      SESSION_ENCRYPTION_KEY: options.encryptionKey,
      // La sesión de HikariRO marca el límite real: el vigilante la mantiene viva.
      SESSION_TTL_HOURS: '720',
      COOKIE_SECURE: 'false',
      ALLOW_REMEMBER: 'true',
      // Un solo usuario en su propio PC: solo se limitan el login y las rutas sensibles.
      RATE_LIMIT_PER_MINUTE: '0',
      HIKARI_USER_AGENT: `HikariHub/${options.version}`,
      ...(options.hikariBaseUrl && { HIKARI_BASE_URL: options.hikariBaseUrl }),
      ...(options.newsFeedUrl && { HIKARI_NEWS_FEED_URL: options.newsFeedUrl }),
    });
    try {
      const server = await startServer(env, { notifier: options.notifier });
      return { ...server, url };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No hay ningún puerto libre para arrancar Hikari Hub.');
}

export { sanitizeLogText } from './lib/error-journal.js';
