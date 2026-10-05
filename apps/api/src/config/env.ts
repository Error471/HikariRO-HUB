import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const encryptionKey = z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
  message: 'Debe ser una clave de 32 bytes codificada en base64',
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  APP_ORIGIN: z.url(),

  HIKARI_BASE_URL: z.url().default('https://hikariro.com'),
  HIKARI_USER_AGENT: z.string().min(1).default('HikariHub/0.1'),
  HIKARI_NEWS_FEED_URL: z.url().default('https://api.hikariro.com/discord/feed.php'),
  HIKARI_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  SESSION_SECRET: z.string().min(32, 'Debe tener al menos 32 caracteres'),
  SESSION_ENCRYPTION_KEY: encryptionKey,
  SESSION_TTL_HOURS: z.coerce.number().positive().default(48),
  SESSION_REVALIDATE_SECONDS: z.coerce.number().int().positive().default(300),
  COOKIE_SECURE: booleanFromString.default(true),
  /** Permite "Mantener la sesión iniciada" (contraseña cifrada). Solo en la app de escritorio. */
  ALLOW_REMEMBER: booleanFromString.default(false),
  /** Cada cuántos minutos se visita HikariRO para que no cierre la sesión por inactividad (0 = nunca). */
  KEEPALIVE_MINUTES: z.coerce.number().int().min(0).max(60).default(5),

  /** Carpeta donde se guardan sesiones, favoritos y avisos. Sin ella, todo vive en memoria. */
  DATA_DIR: z.string().min(1).optional(),
  /** Build de la web (`apps/web/dist`) para servirla desde la propia API. */
  WEB_DIST_DIR: z.string().min(1).optional(),
  /** Archivo de log; sin él se escribe en la salida estándar. */
  LOG_FILE: z.string().min(1).optional(),

  /** Contacto del responsable de esta instancia, mostrado en la página de privacidad. */
  PRIVACY_CONTACT: z.string().trim().max(200).optional(),

  /** API de bots de Telegram (configurable para las pruebas). */
  TELEGRAM_API_URL: z.url().default('https://api.telegram.org'),

  /** Cada cuánto consulta el MVP Timer el vigilante de avisos. */
  ALERT_POLL_SECONDS: z.coerce.number().int().min(30).max(600).default(60),

  /** Límite global de peticiones a /api por minuto e IP (0 = solo login y rutas sensibles). */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(300),

  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  return result.data;
}
