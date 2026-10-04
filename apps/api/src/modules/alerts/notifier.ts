import type { AlertMessage } from '@hikari-hub/shared';

/** Quien muestra las notificaciones: la app de escritorio inyecta las de Windows. */
export interface Notifier {
  notify(message: AlertMessage): Promise<boolean>;
}
