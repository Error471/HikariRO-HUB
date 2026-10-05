import type { AlertConfigResponse } from '@hikari-hub/shared';
import { ExternalLink, Skull, Star } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatEpoch, formatEpochRange } from '@/lib/format';
import type { ChannelChoice } from '@/features/notifications/alerts';
import { MvpAlertMenu } from './MvpAlertMenu';
import {
  formatCountdown,
  stateDescriptions,
  stateLabels,
  type MvpView,
  type SpawnStateKey,
  type SpawnView,
} from './mvp-status';

const HIKARI = 'https://hikariro.com';

export const stateStyles: Record<SpawnStateKey, { pill: string; bar: string; text: string }> = {
  window: {
    pill: 'bg-ember-400/12 text-ember-400 ring-ember-400/35',
    bar: 'bg-ember-400',
    text: 'text-ember-400',
  },
  cooldown: {
    pill: 'bg-mana-400/12 text-mana-300 ring-mana-400/30',
    bar: 'bg-mana-400',
    text: 'text-mana-300',
  },
  ready: {
    pill: 'bg-leaf-400/10 text-leaf-400 ring-leaf-400/30',
    bar: 'bg-leaf-400/60',
    text: 'text-leaf-400',
  },
};

function MvpPortrait({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-night-950/70 ring-1 ring-white/8">
      {failed ? (
        <Skull aria-hidden="true" className="size-6 text-ink-faint" />
      ) : (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="max-h-14 max-w-14 object-contain [image-rendering:pixelated]"
        />
      )}
    </div>
  );
}

function SpawnRow({ spawn }: { spawn: SpawnView }) {
  const { state } = spawn;
  const styles = stateStyles[state.key];
  return (
    <li className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/6 py-3 text-sm first:border-t-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
      <div className="min-w-0">
        <p className="text-[0.68rem] uppercase tracking-wider text-ink-faint">Mapa</p>
        <a
          href={`${HIKARI}/?module=map&action=view&map=${encodeURIComponent(spawn.map)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-[0.82rem] text-ink hover:text-gold-300"
        >
          {spawn.map}
        </a>
      </div>
      <div>
        <p className="text-[0.68rem] uppercase tracking-wider text-ink-faint">Última muerte</p>
        <p className="tabular-nums text-ink-muted">
          {spawn.killedAt ? formatEpoch(spawn.killedAt) : 'Sin registro'}
        </p>
      </div>
      <div>
        <p className="text-[0.68rem] uppercase tracking-wider text-ink-faint">Próxima aparición</p>
        <p className="tabular-nums text-ink-muted">
          {spawn.killedAt && spawn.minAt
            ? spawn.maxAt && spawn.maxAt > spawn.minAt
              ? formatEpochRange(spawn.minAt, spawn.maxAt)
              : formatEpoch(spawn.minAt)
            : 'Disponible'}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-[0.68rem] uppercase tracking-wider text-ink-faint">
          {state.key === 'window' ? 'Máximo en' : 'Restante'}
        </p>
        <p
          className={cn('font-mono text-base font-semibold tabular-nums', styles.text)}
          title={stateDescriptions[state.key]}
        >
          {state.remaining === null ? '—' : formatCountdown(state.remaining)}
        </p>
      </div>
      <div
        className="col-span-full h-1 overflow-hidden rounded-full bg-white/6"
        role="progressbar"
        aria-label={`Progreso: ${stateLabels[state.key]}`}
        aria-valuenow={Math.round(state.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-1000 ease-linear',
            styles.bar,
          )}
          style={{ width: `${state.progress}%` }}
        />
      </div>
    </li>
  );
}

interface MvpCardProps {
  mvp: MvpView;
  favorite: boolean;
  onToggleFavorite: (id: number) => void;
  alertChannel: ChannelChoice;
  alertConfig: AlertConfigResponse | undefined;
  onAlertChannelChange: (id: number, channel: ChannelChoice) => void;
}

export function MvpCard({
  mvp,
  favorite,
  onToggleFavorite,
  alertChannel,
  alertConfig,
  onAlertChannelChange,
}: MvpCardProps) {
  const styles = stateStyles[mvp.state.key];
  return (
    <article
      className={cn(
        'rounded-card border bg-night-850/80 p-4 transition-colors sm:p-5',
        mvp.state.key === 'window' ? 'border-ember-400/25' : 'border-white/7',
      )}
    >
      <header className="flex items-start gap-4">
        <MvpPortrait src={mvp.imageUrl} name={mvp.name} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold tracking-tight">
            <a
              href={mvp.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-gold-300"
            >
              {mvp.name}
            </a>
            <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
          </h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            ID {mvp.id} · {mvp.spawns.length} {mvp.spawns.length === 1 ? 'mapa' : 'mapas'}
            {mvp.activeSpawns > 0 &&
              ` · ${mvp.activeSpawns} ${mvp.activeSpawns === 1 ? 'activo' : 'activos'}`}
          </p>
          <span
            className={cn(
              'mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
              styles.pill,
            )}
            title={stateDescriptions[mvp.state.key]}
          >
            {stateLabels[mvp.state.key]}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <MvpAlertMenu
            mvpName={mvp.name}
            value={alertChannel}
            config={alertConfig}
            onChange={(channel) => onAlertChannelChange(mvp.id, channel)}
          />
          <button
            type="button"
            onClick={() => onToggleFavorite(mvp.id)}
            aria-pressed={favorite}
            aria-label={
              favorite ? `Quitar ${mvp.name} de favoritos` : `Añadir ${mvp.name} a favoritos`
            }
            className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-white/5 hover:text-gold-300"
          >
            <Star
              aria-hidden="true"
              className={cn('size-5', favorite && 'fill-gold-400 text-gold-400')}
            />
          </button>
        </div>
      </header>
      <ul className="mt-3">
        {mvp.spawns.map((spawn, index) => (
          <SpawnRow key={`${spawn.map}-${index}`} spawn={spawn} />
        ))}
      </ul>
    </article>
  );
}
