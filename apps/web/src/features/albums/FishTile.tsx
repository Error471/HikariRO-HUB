import type { Fish } from '@hikari-hub/shared';
import { Fish as FishIcon, MapPin } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';

const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });

function Stars({ value }: { value: number }) {
  return (
    <span
      role="img"
      aria-label={`Calidad: ${value} de 5`}
      className="flex justify-center gap-0.5 text-lg leading-none"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={index < value ? 'text-gold-400' : 'text-white/15'}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function FishImage({
  src,
  discovered,
  iconUrl,
}: {
  src: string;
  discovered: boolean;
  iconUrl?: string | null;
}) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(!src);
  if (failed) return <FishIcon aria-hidden="true" className="size-10 text-ink-faint" />;
  return (
    <img
      src={current}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => (iconUrl && current !== iconUrl ? setCurrent(iconUrl) : setFailed(true))}
      className={cn(
        'h-20 w-28 object-contain',
        !discovered && 'opacity-30 grayscale brightness-50',
      )}
    />
  );
}

export function FishTile({ fish }: { fish: Fish }) {
  if (!fish.discovered) {
    return (
      <article className="flex flex-col items-center gap-2 rounded-card border border-dashed border-white/8 bg-night-850/40 p-4 text-center">
        <FishImage src={fish.imageUrl} discovered={false} />
        <h3 className="font-display text-lg text-ink-faint">???</h3>
        <Stars value={0} />
        <p className="text-xs text-ink-faint">Sin descubrir</p>
      </article>
    );
  }

  return (
    <article className="flex flex-col items-center gap-2 rounded-card border border-white/8 bg-night-850 p-4 text-center">
      <FishImage src={fish.imageUrl} iconUrl={fish.iconUrl} discovered />
      <h3 className="font-semibold text-ink">
        {fish.itemId ? (
          <a
            href={`https://hikariro.com/?module=item&action=view&id=${fish.itemId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-mana-300"
          >
            {fish.name}
          </a>
        ) : (
          fish.name
        )}
      </h3>
      <Stars value={fish.stars} />
      <dl className="mt-1 grid w-full gap-1 text-xs sm:grid-cols-3">
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-ink-faint">Récord</dt>
          <dd className="whitespace-nowrap tabular-nums text-ink">
            {fish.sizeCm !== null ? `${decimal.format(fish.sizeCm)} cm` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-ink-faint">Peso</dt>
          <dd className="whitespace-nowrap tabular-nums text-ink">
            {fish.weightKg !== null ? `${decimal.format(fish.weightKg)} kg` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-ink-faint">Capturas</dt>
          <dd className="whitespace-nowrap tabular-nums text-ink">
            {fish.catches !== null ? formatCount(fish.catches) : '—'}
          </dd>
        </div>
      </dl>
      {fish.bestMap && (
        <p
          className="flex items-center gap-1 font-mono text-xs text-ink-muted"
          title="Mapa del ejemplar más grande"
        >
          <MapPin aria-hidden="true" className="size-3.5" />
          {fish.bestMap}
        </p>
      )}
    </article>
  );
}
