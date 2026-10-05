import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Fish, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { Skeleton } from '@/components/ui/Skeleton';
import { cardAlbumQuery, fishingAlbumQuery } from '@/features/albums/album-query';

const firstCardPage = { status: 'all', sort: 'id', q: '', page: 1 } as const;

function AlbumProgress({
  to,
  icon,
  label,
  unit,
  progress,
  isPending,
  failed,
}: {
  to: '/albumes/cartas' | '/albumes/pesca';
  icon: ReactNode;
  label: string;
  unit: string;
  progress: { obtained: number; total: number } | undefined;
  isPending: boolean;
  failed: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-white/4"
      aria-label={`Abrir ${label}`}
    >
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-night-700 text-gold-300 ring-1 ring-white/8">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {isPending ? (
          <Skeleton className="h-14" />
        ) : failed || !progress ? (
          <>
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-1 text-xs text-ink-faint">No disponible ahora mismo.</p>
          </>
        ) : (
          <ProgressMeter
            label={label}
            obtained={progress.obtained}
            total={progress.total}
            unit={unit}
          />
        )}
      </div>
    </Link>
  );
}

/** Progreso de los álbumes de la cuenta. */
export function AlbumsWidget() {
  const cards = useQuery(cardAlbumQuery(firstCardPage));
  const fishing = useQuery(fishingAlbumQuery);

  return (
    <section
      aria-labelledby="widget-albums"
      className="flex flex-col gap-2 rounded-card border border-white/7 bg-night-850/80 p-5"
    >
      <h2 id="widget-albums" className="mb-1 font-display text-lg font-semibold tracking-tight">
        Tus álbumes
      </h2>
      <AlbumProgress
        to="/albumes/cartas"
        icon={<Layers aria-hidden="true" className="size-4.5" />}
        label="Cartas"
        unit="cartas"
        progress={cards.data?.progress}
        isPending={cards.isPending}
        failed={cards.isError && !cards.data}
      />
      <AlbumProgress
        to="/albumes/pesca"
        icon={<Fish aria-hidden="true" className="size-4.5" />}
        label="Pesca"
        unit="especies"
        progress={fishing.data?.progress}
        isPending={fishing.isPending}
        failed={fishing.isError && !fishing.data}
      />
    </section>
  );
}
