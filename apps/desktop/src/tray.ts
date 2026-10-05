import { app, Menu, Tray } from 'electron';

export interface TrayActions {
  open(route?: string): void;
  checkUpdates(): void;
  copyDiagnostics(): void;
  openLogs(): void;
  quit(): void;
}

const HIDDEN_ARG = '--hidden';

/** Al arrancar con Windows la app se queda junto al reloj, sin abrir la ventana. */
export const startedHidden = () => process.argv.includes(HIDDEN_ARG);

function setOpenAtLogin(openAtLogin: boolean) {
  app.setLoginItemSettings({ openAtLogin, args: [HIDDEN_ARG] });
}

/** Icono junto al reloj: mantiene la app (y los avisos) funcionando con la ventana cerrada. */
export function createTray(iconPath: string, actions: TrayActions): Tray {
  const tray = new Tray(iconPath);
  tray.setToolTip('Hikari Hub');

  const build = () =>
    Menu.buildFromTemplate([
      { label: 'Abrir Hikari Hub', click: () => actions.open() },
      { label: 'MVP Timer', click: () => actions.open('/mvp') },
      { type: 'separator' },
      {
        label: 'Abrir al iniciar Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings({ args: [HIDDEN_ARG] }).openAtLogin,
        click: (item) => {
          setOpenAtLogin(item.checked);
          tray.setContextMenu(build());
        },
      },
      { label: 'Buscar actualizaciones', click: () => actions.checkUpdates() },
      { type: 'separator' },
      { label: 'Ver diagnóstico', click: () => actions.open('/diagnostico') },
      { label: 'Copiar diagnóstico', click: () => actions.copyDiagnostics() },
      { label: 'Abrir carpeta de registros', click: () => actions.openLogs() },
      { type: 'separator' },
      { label: 'Salir', click: () => actions.quit() },
    ]);

  tray.setContextMenu(build());
  tray.on('click', () => actions.open());
  return tray;
}
