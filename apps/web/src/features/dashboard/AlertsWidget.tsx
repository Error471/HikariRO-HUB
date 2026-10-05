import { BellOff, BellRing, Monitor, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { NotificationsDialog } from '@/features/notifications/NotificationsDialog';
import { useMvpAlerts } from '@/features/notifications/alerts';
import { cn } from '@/lib/cn';

function StatusLine({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: typeof Monitor;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
      <span className="flex-1 text-sm text-ink-muted">{label}</span>
      <span className={cn('text-sm font-medium', ok ? 'text-leaf-400' : 'text-ink-faint')}>
        {value}
      </span>
    </li>
  );
}

/** Resumen de los avisos de MVP: si están activos y por qué canales llegan. */
export function AlertsWidget() {
  const { config } = useMvpAlerts();
  const data = config.data;
  const marked = data ? Object.keys(data.channels).length : 0;
  const active = Boolean(data?.enabled && marked > 0);

  return (
    <section
      aria-labelledby="widget-alerts"
      className="flex flex-col rounded-card border border-white/7 bg-night-850/80 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="widget-alerts"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
        >
          {active ? (
            <BellRing aria-hidden="true" className="size-5 text-gold-300" />
          ) : (
            <BellOff aria-hidden="true" className="size-5 text-ink-faint" />
          )}
          Avisos
        </h2>
        {data && (
          <span className={cn('text-sm font-medium', active ? 'text-leaf-400' : 'text-ink-faint')}>
            {!data.enabled ? 'En pausa' : marked === 0 ? 'Sin MVPs' : `${marked} MVPs`}
          </span>
        )}
      </header>

      {config.isPending ? (
        <Skeleton className="mt-4 h-24" />
      ) : data ? (
        <ul className="mt-3 flex flex-col divide-y divide-white/6">
          <StatusLine
            icon={Monitor}
            label="Windows"
            value={data.windowsAvailable ? 'Disponible' : 'Solo en la app'}
            ok={data.windowsAvailable}
          />
          <StatusLine
            icon={Send}
            label="Telegram"
            value={
              data.telegram.chatLinked
                ? (data.telegram.botName ?? 'Conectado')
                : data.telegram.configured
                  ? 'Falta vincular el chat'
                  : 'Sin configurar'
            }
            ok={data.telegram.chatLinked}
          />
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No se pudo cargar la configuración.</p>
      )}

      {data && data.enabled && marked > 0 && !data.watching && (
        <p className="mt-2 text-xs text-gold-300">
          La sesión que vigila los respawns caducó: vuelve a entrar para seguir recibiendo avisos.
        </p>
      )}

      <div className="mt-auto pt-4">
        <NotificationsDialog label="Configurar avisos" />
      </div>
    </section>
  );
}
