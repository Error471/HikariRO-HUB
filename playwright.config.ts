import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// Puertos propios para no chocar con `pnpm dev`.
const MOCK_PORT = 4110;
const API_PORT = 3100;
const WEB_PORT = 5190;
const WEB_URL = `http://localhost:${WEB_PORT}`;

const apiEnv = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'warn',
  PORT: String(API_PORT),
  APP_ORIGIN: WEB_URL,
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
    baseURL: WEB_URL,
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
      command: 'pnpm --filter @hrc/api mock:hikari',
      port: MOCK_PORT,
      env: { MOCK_HIKARI_PORT: String(MOCK_PORT) },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @hrc/api exec tsx src/server.ts',
      url: `http://localhost:${API_PORT}/api/health`,
      env: apiEnv,
      reuseExistingServer: false,
    },
    {
      // Build de producción (con service worker real), servido con `vite preview`.
      command: `pnpm --filter @hrc/web exec sh -c "vite build --logLevel warn && vite preview --port ${WEB_PORT} --strictPort"`,
      timeout: 180_000,
      url: WEB_URL,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
