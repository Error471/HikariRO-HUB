import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { MainLogger } from './log.js';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export interface UpdaterEvents {
  /** La versión nueva está descargada; se instala al salir de la app. */
  onReady(version: string): void;
}

/** Busca versiones nuevas en GitHub Releases, las descarga y las instala al cerrar. */
export function setupUpdates(logger: MainLogger, events: UpdaterEvents) {
  const enabled = app.isPackaged;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', (info) => events.onReady(info.version));
  autoUpdater.on('error', (error) =>
    logger.warn(`no se pudo buscar actualizaciones: ${brief(error)}`),
  );

  const check = async (): Promise<'checking' | 'disabled' | 'failed'> => {
    if (!enabled) return 'disabled';
    try {
      await autoUpdater.checkForUpdates();
      return 'checking';
    } catch {
      // Ya lo registra el evento 'error'.
      return 'failed';
    }
  };

  if (enabled) {
    setTimeout(() => void check(), 15_000);
    setInterval(() => void check(), CHECK_EVERY_MS).unref();
  }

  return { check, installNow: () => autoUpdater.quitAndInstall(true, true) };
}

/** Primera línea del error, sin cabeceras ni cookies de la respuesta. */
function brief(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split('\n')[0] ?? '').trim().slice(0, 160);
}
