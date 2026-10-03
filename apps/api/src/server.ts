import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDependencies } from './container.js';
import { MvpWatcher } from './modules/push/mvp-watcher.js';

const env = loadEnv();
const deps = createDependencies(env);
const app = await buildApp(deps);

const watcher = deps.push.enabled
  ? new MvpWatcher({
      store: deps.userData,
      sessions: deps.sessions,
      mvp: deps.mvp,
      push: deps.push,
      intervalMs: env.PUSH_POLL_SECONDS * 1000,
      logger: app.log,
    })
  : null;

async function shutdown(signal: string) {
  app.log.info({ signal }, 'cerrando servidor');
  watcher?.stop();
  await app.close();
  await deps.redis?.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: env.HOST, port: env.PORT });
watcher?.start();
if (!watcher) app.log.info('avisos push desactivados: faltan las claves VAPID');
