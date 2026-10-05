import type { AlertChannel } from '@hikari-hub/shared';
import { Link } from '@tanstack/react-router';
import { BellRing, ChevronRight, Hourglass, Monitor, Send, Star } from 'lucide-react';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFavorites } from '@/features/mvp/favorites';
import { stateStyles } from '@/features/mvp/MvpCard';
import { useMvpList } from '@/features/mvp/mvp-query';
import {
  formatCountdown,
  sortMvpViews,
  stateLabels,
  toMvpView,
  type MvpView,
} from '@/features/mvp/mvp-status';
import { useMvpChannels } from '@/features/notifications/alerts';
import { useNow } from '@/hooks/useNow';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';

const VISIBLE = 6;

const channelIcons: Record<AlertChannel, { icon: typeof Monitor; label: string }> = {
  windows: { icon: Monitor, label: 'Aviso por Windows' },
  telegram: { icon: Send, label: 'Aviso por Telegram' },
  both: { icon: BellRing, label: 'Aviso por Windows y Telegram' },
};

/** Primero los MVPs con aviso o favoritos; el hueco restante, con los próximos en salir. */
export function pickDashboardMvps(
  views: MvpView[],
  tracked: ReadonlySet<number>,
  limit = VISIBLE,
): { mine: MvpView[]; upcoming: MvpView[] } {
  const sorted = sortMvpViews(views);
  const mine = sorted.filter((mvp) => tracked.has(mvp.id)).slice(0, limit);
  const upcoming = sorted
    .filter((mvp) => !tracked.has(mvp.id) && mvp.state.key !== 'ready')
    .slice(0, Math.max(0, limit - mine.length));
  return { mine, upcoming };
}

function MvpRow({
  mvp,
  channel,
  favorite,
}: {
  mvp: MvpView;
  channel: AlertChannel | null;
  favorite: boolean;
}) {
  const spawn = mvp.spawns[0];
  const ChannelIcon = channel ? channelIcons[channel].icon : null;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <img
        src={mvp.imageUrl}
        alt=""
        loading="lazy"
        className="size-9 shrink-0 object-contain [image-rendering:pixelated]"
        onError={(event) => {
          event.currentTarget.style.visibility = 'hidden';
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{mvp.name}</span>
          {favorite && (
            <Star aria-label="Favorito" className="size-3.5 shrink-0 fill-gold-400 text-gold-400" />
          )}
          {channel && ChannelIcon && (
            <ChannelIcon
              aria-label={channelIcons[channel].label}
              className="size-3.5 shrink-0 text-gold-300"
            />
          )}
        </p>
        <p className="truncate font-mono text-xs text-ink-faint">{spawn?.map}</p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            stateStyles[mvp.state.key].text,
          )}
        >
          {mvp.state.remaining === null ? '—' : formatCountdown(mvp.state.remaining)}
        </p>
        <p className="text-[0.7rem] text-ink-faint">{stateLabels[mvp.state.key]}</p>
      </div>
    </li>
  );
}

export function MvpWidget() {
  const { data, error, isPending, offset } = useMvpList();
  const favorites = useFavorites();
  const channels = useMvpChannels();
  const now = useNow(1000) + offset;

  const views = useMemo(() => (data?.mvps ?? []).map((mvp) => toMvpView(mvp, now)), [data, now]);
  const tracked = useMemo(
    () => new Set([...favorites.values, ...channels.alerted]),
    [favorites.values, channels.alerted],
  );
  const { mine, upcoming } = pickDashboardMvps(views, tracked);
  const personal = mine.length > 0;
  const renderRows = (list: MvpView[]) => (
    <ul className="flex flex-col divide-y divide-white/6">
      {list.map((mvp) => {
        const channel = channels.channelOf(mvp.id);
        return (
          <MvpRow
            key={`${mvp.id}-${mvp.name}`}
            mvp={mvp}
            channel={channel === 'none' ? null : channel}
            favorite={favorites.values.has(mvp.id)}
          />
        );
      })}
    </ul>
  );
  const inWindow = views.filter((mvp) => mvp.state.key === 'window').length;
  const inCooldown = views.filter((mvp) => mvp.state.key === 'cooldown').length;

  return (
    <section
      aria-labelledby="widget-mvp"
      className="panel flex h-full flex-col rounded-card p-5 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="widget-mvp"
            className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight"
          >
            <Hourglass aria-hidden="true" className="size-5 text-gold-300" />
            {personal ? 'Tus MVPs' : 'Próximos MVPs'}
          </h2>
          {data && (
            <p className="mt-1 text-sm text-ink-muted">
              <span className="text-ember-400">{inWindow} en ventana de respawn</span> ·{' '}
              <span className="text-mana-300">{inCooldown} en espera</span> · {views.length} MVPs
            </p>
          )}
        </div>
        <Link
          to="/mvp"
          search={{ filter: personal ? 'alerts' : 'all' }}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-medium text-gold-300 hover:text-gold-200"
        >
          Ver todos
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <div className="mt-4 flex-1">
        {isPending ? (
          <div aria-busy="true" aria-label="Cargando MVPs" className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : error && !data ? (
          <p role="alert" className="text-sm text-ember-400">
            {errorMessage(error)}
          </p>
        ) : mine.length + upcoming.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No hay muertes recientes: todos los MVPs figuran como disponibles.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {personal && renderRows(mine)}
            {upcoming.length > 0 && (
              <div>
                {personal && (
                  <h3 className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-faint">
                    Próximos en salir
                  </h3>
                )}
                {renderRows(upcoming)}
              </div>
            )}
          </div>
        )}
      </div>

      {!personal && data && (
        <p className="mt-4 border-t border-white/6 pt-3 text-xs text-ink-faint">
          Marca MVPs con la estrella o la campana en el MVP Timer para seguirlos aquí.
        </p>
      )}
    </section>
  );
}
