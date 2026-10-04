import { loadEnv } from './config/env.js';
import { startServer } from './runtime.js';

// Arranque para desarrollo (`pnpm dev`): la app de escritorio usa `desktop.ts`.
const env = loadEnv();
const server = await startServer(env);

async function shutdown(signal: string) {
  server.app.log.info({ signal }, 'cerrando servidor');
  await server.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
