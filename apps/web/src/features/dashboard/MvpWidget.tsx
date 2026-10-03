import { Link } from '@tanstack/react-router';
import { ChevronRight, Hourglass } from 'lucide-react';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { stateStyles } from '@/features/mvp/MvpCard';
import { useMvpList } from '@/features/mvp/mvp-query';
import { formatCountdown, sortMvpViews, stateLabels, toMvpView } from '@/features/mvp/mvp-status';
import { useNow } from '@/hooks/useNow';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';

const VISIBLE = 4;

export function MvpWidget() {
  const { data, error, isPending, offset } = useMvpList();
  const now = useNow(1000) + offset;
  const views = useMemo(
    () => sortMvpViews((data?.mvps ?? []).map((mvp) => toMvpView(mvp, now))),
    [data, now],
  );
  const inWindow = views.filter((mvp) => mvp.state.key === 'window').length;
  const inCooldown = views.filter((mvp) => mvp.state.key === 'cooldown').length;
  const upcoming = views.filter((mvp) => mvp.state.key !== 'ready').slice(0, VISIBLE);

  return (
    <section
      aria-labelledby="widget-mvp"
      className="frame-gold flex flex-col rounded-card p-5 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="widget-mvp"
            className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide"
          >
            <Hourglass aria-hidden="true" className="size-5 text-gold-300" />
            MVP Timer
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
          search={{ filter: 'all' }}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-medium text-gold-300 hover:text-gold-200"
        >
          Ver todos
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <div className="mt-4 flex-1">
        {isPending ? (
          <div aria-busy="true" aria-label="Cargando MVPs" className="flex flex-col gap-2">
            {Array.from({ length: VISIBLE }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : error && !data ? (
          <p role="alert" className="text-sm text-ember-400">
            {errorMessage(error)}
          </p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No hay muertes recientes: todos los MVPs figuran como disponibles.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/6">
            {upcoming.map((mvp) => {
              const spawn = mvp.spawns[0];
              return (
                <li key={`${mvp.id}-${mvp.name}`} className="flex items-center gap-3 py-2.5">
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
                    <p className="truncate text-sm font-medium">{mvp.name}</p>
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
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
