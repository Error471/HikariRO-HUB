import { sanitizeLogText, startDesktopServer, type DesktopServer } from '@hikari-hub/api/desktop';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  Menu,
  Notification,
  safeStorage,
  session,
  shell,
  type Tray,
} from 'electron';
import { arch, release, type } from 'node:os';
import { dirname, join } from 'node:path';
import { formatDiagnostics, readLogText } from './diagnostics.js';
import { createMainLogger, prepareLogFile } from './log.js';
import { appRoute, isAppUrl, isExternalWebUrl } from './navigation.js';
import { WindowsNotifier } from './notifier.js';
import { readPreferences, writePreferences } from './preferences.js';
import { loadSecrets } from './secrets.js';
import { createTray, startedHidden } from './tray.js';
import { setupUpdates } from './updater.js';

// --- Rutas y configuración ---
const APP_ID = 'com.hikarihub.app';
// Puerto fijo (con alternativas): el navegador interno guarda su estado por puerto.
const PORTS = Array.from({ length: 10 }, (_, index) => 47231 + index);

const resources = app.isPackaged ? process.resourcesPath : join(__dirname, '..');
const webDir = app.isPackaged ? join(resources, 'web') : join(__dirname, '../../web/dist');
const iconDir = app.isPackaged ? join(resources, 'icons') : join(__dirname, '../build');
const appIcon = join(iconDir, 'icon.png');
// Windows usa .ico (nítido a 16 px); el resto de sistemas no lo admite.
const trayIcon = join(iconDir, process.platform === 'win32' ? 'icon.ico' : 'icon.png');

const userData = app.getPath('userData');
const logFile = join(app.getPath('logs'), 'hikari-hub.log');
const preferencesFile = join(userData, 'preferences.json');

prepareLogFile(logFile);
const logger = createMainLogger(logFile);

let server: DesktopServer | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

// --- Una sola instancia ---
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => openWindow());
  app.setAppUserModelId(APP_ID);
  Menu.setApplicationMenu(null);
  void app.whenReady().then(() =>
    start().catch((error: unknown) => {
      logger.error('error al arrancar', error);
      dialog.showErrorBox('No se pudo iniciar Hikari Hub', 'Se ha producido un error inesperado.');
      app.exit(1);
    }),
  );
}

// --- Ventana ---
function openWindow(route?: string) {
  if (!server) return;
  const url = server.url + appRoute(route ?? '/');
  if (!mainWindow) {
    mainWindow = createWindow(server.url);
    void mainWindow.loadURL(url);
    return;
  }
  if (route) void mainWindow.loadURL(url);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow(appOrigin: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Hikari Hub',
    icon: appIcon,
    backgroundColor: '#0e0e11',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  // Los enlaces externos (HikariRO, Discord…) se abren en el navegador del usuario.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, appOrigin)) return;
    event.preventDefault();
    if (isExternalWebUrl(url)) void shell.openExternal(url);
  });

  // Cerrar la ventana no cierra la app: los avisos siguen funcionando.
  window.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    window.hide();
    showTrayHintOnce();
  });
  window.on('closed', () => {
    mainWindow = null;
  });
  return window;
}

function showTrayHintOnce() {
  const preferences = readPreferences(preferencesFile);
  if (preferences.trayHintShown || !Notification.isSupported()) return;
  new Notification({
    title: 'Hikari Hub sigue abierto',
    body: 'Está junto al reloj para avisarte de tus MVPs. Para cerrarlo del todo: clic derecho → Salir.',
    icon: appIcon,
  }).show();
  writePreferences(preferencesFile, { ...preferences, trayHintShown: true });
}

// --- Arranque ---
async function start() {
  // La app no necesita cámara, micrófono, ubicación ni notificaciones web.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );

  const secrets = loadSecrets(join(userData, 'secrets.bin'), {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain),
    decrypt: (data) => safeStorage.decryptString(data),
  });

  try {
    server = await startDesktopServer({
      dataDir: join(userData, 'data'),
      webDir,
      logFile,
      notifier: new WindowsNotifier(appIcon, (route) => openWindow(route)),
      sessionSecret: secrets.sessionSecret,
      encryptionKey: secrets.encryptionKey,
      ports: PORTS,
      version: app.getVersion(),
      // Solo en desarrollo: permite probar la app contra el mock de HikariRO.
      ...(!app.isPackaged && {
        hikariBaseUrl: process.env.HIKARI_HUB_HIKARI_URL,
        newsFeedUrl: process.env.HIKARI_HUB_NEWS_URL,
      }),
    });
  } catch (error) {
    logger.error('no se pudo arrancar el servidor local', error);
    dialog.showErrorBox(
      'No se pudo iniciar Hikari Hub',
      'Cierra otras copias de Hikari Hub o reinicia el PC e inténtalo de nuevo.',
    );
    app.exit(1);
    return;
  }

  const updates = setupUpdates(logger, {
    onReady(version) {
      if (!Notification.isSupported()) return;
      const notification = new Notification({
        title: `Hikari Hub ${version} está lista`,
        body: 'Se instalará al cerrar la app. Pulsa aquí para reiniciar ahora.',
        icon: appIcon,
      });
      notification.on('click', () => {
        quitting = true;
        updates.installNow();
      });
      notification.show();
    },
  });

  if (!startedHidden()) openWindow();

  tray = createTray(trayIcon, {
    open: (route) => openWindow(route),
    checkUpdates: () => {
      void updates.check().then((status) => {
        if (status === 'checking') return;
        void dialog.showMessageBox({
          type: 'info',
          title: 'Hikari Hub',
          message:
            status === 'disabled'
              ? 'Las actualizaciones solo funcionan en la versión instalada.'
              : 'No se pudo comprobar si hay actualizaciones. Inténtalo más tarde.',
        });
      });
    },
    copyDiagnostics: () => copyDiagnostics(),
    openLogs: () => void shell.openPath(dirname(logFile)),
    quit: () => {
      quitting = true;
      app.quit();
    },
  });

  logger.info(`Hikari Hub ${app.getVersion()} en ${server.url}`);
}

// --- Diagnóstico ---
function copyDiagnostics() {
  clipboard.writeText(
    formatDiagnostics(readLogText(logFile), {
      version: app.getVersion(),
      platform: `${type()} ${release()} (${arch()})`,
      sanitize: sanitizeLogText,
    }),
  );
  if (!Notification.isSupported()) return;
  new Notification({
    title: 'Diagnóstico copiado',
    body: 'Pégalo en tu mensaje al reportar el problema. No incluye contraseñas ni tokens.',
    icon: appIcon,
  }).show();
}

// --- Cierre ---
app.on('window-all-closed', () => {
  // Se queda en la bandeja; solo "Salir" cierra la app.
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('will-quit', (event) => {
  if (!server) return;
  event.preventDefault();
  const closing = server;
  server = null;
  tray?.destroy();
  void closing
    .close()
    .catch((error: unknown) => logger.warn('error al cerrar el servidor local', error))
    .finally(() => app.quit());
});
