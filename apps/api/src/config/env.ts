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
  TRUST_PROXY: booleanFromString.default(false),

  APP_ORIGIN: z.url(),

  HIKARI_BASE_URL: z.url().default('https://hikariro.com'),
  HIKARI_USER_AGENT: z.string().min(1).default('HikariRO-Companion/0.1'),
  HIKARI_NEWS_FEED_URL: z.url().default('https://api.hikariro.com/discord/feed.php'),
  HIKARI_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  SESSION_SECRET: z.string().min(32, 'Debe tener al menos 32 caracteres'),
  SESSION_ENCRYPTION_KEY: encryptionKey,
  SESSION_TTL_HOURS: z.coerce.number().positive().default(48),
  SESSION_REVALIDATE_SECONDS: z.coerce.number().int().positive().default(300),
  COOKIE_SECURE: booleanFromString.default(true),

  REDIS_URL: z.string().optional(),

  /** Contacto del responsable de esta instancia, mostrado en la página de privacidad. */
  PRIVACY_CONTACT: z.string().trim().max(200).optional(),

  // Avisos push (opcionales): genera las claves con `pnpm --filter @hrc/api vapid`.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/, 'Debe empezar por mailto: o https://')
    .optional(),
  PUSH_POLL_SECONDS: z.coerce.number().int().min(30).max(600).default(60),

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
  if (result.data.NODE_ENV === 'production' && !result.data.REDIS_URL) {
    throw new Error('Configuración inválida:\n  - REDIS_URL es obligatoria en producción');
  }
  const vapid = [
    result.data.VAPID_PUBLIC_KEY,
    result.data.VAPID_PRIVATE_KEY,
    result.data.VAPID_SUBJECT,
  ];
  if (vapid.some(Boolean) && !vapid.every(Boolean)) {
    throw new Error(
      'Configuración inválida:\n  - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT van juntas',
    );
  }
  return result.data;
}
