import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Puertos propios para no chocar con `pnpm dev`.
const MOCK_PORT = 4110;
const APP_PORT = 3100;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;

// Igual que la app de escritorio: la API sirve el build de la web en un solo origen.
const apiEnv = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'warn',
  HOST: '127.0.0.1',
  PORT: String(APP_PORT),
  APP_ORIGIN: APP_URL,
  WEB_DIST_DIR: fileURLToPath(new URL('./apps/web/dist', import.meta.url)),
  HIKARI_BASE_URL: `http://localhost:${MOCK_PORT}`,
  HIKARI_NEWS_FEED_URL: `http://localhost:${MOCK_PORT}/discord/feed.php`,
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  SESSION_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  COOKIE_SECURE: 'false',
  LOGIN_MAX_ATTEMPTS: '50',
};

/** Ruta a un Chromium ya instalado (p. ej. en contenedores sin `playwright install`). */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: APP_URL,
    locale: 'es-ES',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @hikari-hub/api mock:hikari',
      port: MOCK_PORT,
      env: { MOCK_HIKARI_PORT: String(MOCK_PORT) },
      reuseExistingServer: false,
    },
    {
      command:
        'pnpm --filter @hikari-hub/web exec vite build --logLevel warn && pnpm --filter @hikari-hub/api exec tsx src/server.ts',
      timeout: 180_000,
      url: `${APP_URL}/api/health`,
      env: apiEnv,
      reuseExistingServer: false,
    },
  ],
});
