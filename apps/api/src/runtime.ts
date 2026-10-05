import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { Env } from './config/env.js';
import { createDependencies, type ContainerOptions } from './container.js';
import { MvpWatcher } from './modules/alerts/mvp-watcher.js';
import { SessionKeeper } from './session/session-keeper.js';

export interface RunningServer {
  app: FastifyInstance;
  close(): Promise<void>;
}

/** Arranca la API, el mantenimiento de sesiones y el vigilante de MVPs. */
export async function startServer(
  env: Env,
  options: ContainerOptions = {},
): Promise<RunningServer> {
  const deps = createDependencies(env, options);
  const app = await buildApp(deps);

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    await app.close();
    throw error;
  }

  // Siempre activo: aunque no haya Windows, los avisos pueden ir por Telegram.
  const watcher = new MvpWatcher({
    store: deps.userData,
    sessions: deps.sessions,
    mvp: deps.mvp,
    alerts: deps.alerts,
    intervalMs: env.ALERT_POLL_SECONDS * 1000,
    logger: app.log,
  });
  watcher.start();

  const keeper =
    env.KEEPALIVE_MINUTES > 0
      ? new SessionKeeper({
          sessions: deps.sessions,
          hikari: deps.hikariAuth,
          intervalMs: env.KEEPALIVE_MINUTES * 60_000,
          logger: app.log,
        })
      : null;
  keeper?.start();

  return {
    app,
    async close() {
      keeper?.stop();
      watcher.stop();
      await app.close();
    },
  };
}
