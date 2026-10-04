import type { AlbumCard } from '@hikari-hub/shared';
import { Check, HelpCircle, Layers } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/** Carta de la colección. Las no obtenidas se muestran apagadas, como en HikariRO. */
export function CardTile({ card }: { card: AlbumCard }) {
  const [source, setSource] = useState<'image' | 'icon' | 'none'>('image');
  const src = source === 'image' ? card.imageUrl : card.iconUrl;

  return (
    <a
      href={card.detailUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`${card.name} · ${card.obtained ? 'Obtenida' : 'No obtenida'}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border bg-night-850/80 transition duration-300',
        card.obtained
          ? 'border-gold-400/25 hover:border-gold-400/50'
          : 'border-white/6 hover:border-white/15',
      )}
    >
      <div className="relative grid aspect-[3/4] place-items-center bg-night-800 p-3">
        {source === 'none' ? (
          <Layers aria-hidden="true" className="size-8 text-ink-faint" />
        ) : (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setSource(source === 'image' ? 'icon' : 'none')}
            className={cn(
              'max-h-full max-w-full object-contain drop-shadow-[0_6px_14px_rgb(0_0_0/0.5)] transition',
              !card.obtained && 'opacity-35 grayscale',
              source === 'icon' && 'size-10 [image-rendering:pixelated]',
            )}
          />
        )}
        <span
          className={cn(
            'absolute top-2 right-2 grid size-7 place-items-center rounded-full ring-1',
            card.obtained
              ? 'bg-leaf-400/15 text-leaf-400 ring-leaf-400/40'
              : 'bg-night-950/70 text-ink-faint ring-white/15',
          )}
        >
          {card.obtained ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <HelpCircle aria-hidden="true" className="size-4" />
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3
          className={cn(
            'line-clamp-2 text-sm leading-snug font-medium',
            card.obtained ? 'text-ink' : 'text-ink-muted',
          )}
        >
          {card.name}
        </h3>
        <p className="mt-auto flex items-center justify-between text-xs">
          <span className="text-ink-faint tabular-nums">ID {card.id}</span>
          <span className={card.obtained ? 'text-leaf-400' : 'text-ink-faint'}>
            {card.obtained ? 'Obtenida' : 'No obtenida'}
          </span>
        </p>
      </div>
    </a>
  );
}
