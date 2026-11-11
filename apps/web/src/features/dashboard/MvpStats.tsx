import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFavorites } from '@/features/mvp/favorites';
import { useMvpList } from '@/features/mvp/mvp-query';
import { toMvpView, type MvpFilter } from '@/features/mvp/mvp-status';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';

interface Stat {
  filter: MvpFilter;
  label: string;
  hint: string;
  value: number;
  dot: string;
}

/** Resumen del MVP Timer en cuatro cifras; cada una abre el timer con ese filtro. */
export function MvpStats() {
  const { data, isPending, offset } = useMvpList();
  const favorites = useFavorites();
  const now = useNow(1000) + offset;

  const counts = useMemo(() => {
    const result = { window: 0, cooldown: 0, ready: 0 };
    for (const mvp of data?.mvps ?? []) result[toMvpView(mvp, now).state.key] += 1;
    return result;
  }, [data, now]);

  const stats: Stat[] = [
    {
      filter: 'window',
      label: 'Respawn aleatorio',
      hint: 'Pueden salir ya',
      value: counts.window,
      dot: 'bg-ember-400',
    },
    {
      filter: 'cooldown',
      label: 'En espera',
      hint: 'Aún no reaparecen',
      value: counts.cooldown,
      dot: 'bg-mana-400',
    },
    {
      filter: 'ready',
      label: 'Disponibles',
      hint: 'Sin muerte reciente',
      value: counts.ready,
      dot: 'bg-leaf-400',
    },
    {
      filter: 'favorites',
      label: 'Favoritos',
      hint: 'Los que sigues',
      value: favorites.values.size,
      dot: 'bg-gold-400',
    },
  ];

  return (
    <ul aria-label="Resumen del MVP Timer" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <li key={stat.filter}>
          <Link
            to="/mvp"
            search={{ filter: stat.filter }}
            className="flex h-full flex-col rounded-card surface px-5 py-4 transition-colors duration-300 hover:border-white/16"
          >
            <span className="flex items-center gap-2 text-xs text-ink-muted">
              <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', stat.dot)} />
              <span className="truncate">{stat.label}</span>
            </span>
            {isPending ? (
              <Skeleton className="mt-2 h-12 w-12" />
            ) : (
              <span className="mt-2 font-display text-5xl leading-none tabular-nums text-ink">
                {data || stat.filter === 'favorites' ? stat.value : '—'}
              </span>
            )}
            <span className="mt-1.5 truncate text-xs text-ink-faint">{stat.hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
