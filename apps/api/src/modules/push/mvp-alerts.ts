import type { LeadMinutes, MvpListResponse, PushMessage } from '@hrc/shared';

export interface MvpAlert {
  /** Identificador estable del aviso, para no enviarlo dos veces. */
  key: string;
  message: PushMessage;
}

export interface DueAlertsInput {
  data: MvpListResponse;
  favorites: ReadonlySet<number>;
  leadMinutes: LeadMinutes;
  /** Margen tras el momento del aviso en el que aún se envía (cubre el intervalo de sondeo). */
  graceSeconds: number;
}

const MVP_URL = '/mvp?filter=favorites';

function minutesLabel(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

/** Avisos que tocan ahora para los MVPs favoritos, con la hora del servidor de HikariRO. */
export function dueAlerts({
  data,
  favorites,
  leadMinutes,
  graceSeconds,
}: DueAlertsInput): MvpAlert[] {
  const now = data.serverNow;
  const isDue = (at: number) => now >= at && now < at + graceSeconds;
  const alerts: MvpAlert[] = [];

  for (const mvp of data.mvps) {
    if (!favorites.has(mvp.id)) continue;
    for (const { map, minAt, maxAt } of mvp.spawns) {
      if (minAt === null) continue;
      const tag = `mvp-${mvp.id}-${map}`;
      const base = `${mvp.id}:${map}:${minAt}`;

      if (leadMinutes > 0 && isDue(minAt - leadMinutes * 60) && now < minAt) {
        alerts.push({
          key: `${base}:lead`,
          message: {
            title: `${mvp.name} sale pronto`,
            body: `Puede aparecer en ${minutesLabel(minAt - now)} en ${map}.`,
            tag,
            url: MVP_URL,
          },
        });
      }

      const windowOpen = maxAt === null || now < maxAt;
      if (isDue(minAt) && windowOpen) {
        alerts.push({
          key: `${base}:window`,
          message: {
            title: `${mvp.name} puede aparecer ya`,
            body:
              maxAt === null
                ? `Ventana de respawn abierta en ${map}.`
                : `Ventana de respawn abierta en ${map} durante ${minutesLabel(maxAt - now)}.`,
            tag,
            url: MVP_URL,
          },
        });
      }
    }
  }
  return alerts;
}
