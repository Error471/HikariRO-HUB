import type { AlertMessage, Notifier } from '@hikari-hub/api/desktop';
import { Notification } from 'electron';

/** Notificaciones nativas de Windows; al pulsarlas se abre la app en la ruta del aviso. */
export class WindowsNotifier implements Notifier {
  // Windows pierde el clic si la notificación se libera antes de tiempo.
  private readonly active = new Set<Notification>();

  constructor(
    private readonly iconPath: string,
    private readonly open: (route: string) => void,
  ) {}

  async notify(message: AlertMessage): Promise<boolean> {
    if (!Notification.isSupported()) return false;
    const notification = new Notification({
      title: message.title,
      body: message.body,
      icon: this.iconPath,
    });
    const release = () => this.active.delete(notification);
    notification.on('click', () => {
      release();
      this.open(message.url);
    });
    notification.on('close', release);
    this.active.add(notification);
    notification.show();
    return true;
  }
}
