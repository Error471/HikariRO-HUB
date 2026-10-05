import type { Mvp, MvpSpawn } from '@hikari-hub/shared';

export type SpawnStateKey = 'window' | 'cooldown' | 'ready';

export interface SpawnState {
  key: SpawnStateKey;
  /** Segundos hasta el final del estado actual; `null` si el MVP está disponible. */
  remaining: number | null;
  /** Progreso del estado actual (0-100). */
  progress: number;
}

export interface SpawnView extends MvpSpawn {
  state: SpawnState;
}

export interface MvpView extends Omit<Mvp, 'spawns'> {
  spawns: SpawnView[];
  state: SpawnState;
  activeSpawns: number;
}

export const stateLabels: Record<SpawnStateKey, string> = {
  window: 'Respawn aleatorio',
  cooldown: 'En espera',
  ready: 'Disponible',
};

export const stateDescriptions: Record<SpawnStateKey, string> = {
  window: 'Ya pasó el tiempo mínimo: puede aparecer en cualquier momento hasta el máximo.',
  cooldown: 'Murió hace poco y todavía no puede reaparecer.',
  ready: 'Sin muerte reciente registrada: se considera disponible.',
};

const priority: Record<SpawnStateKey, number> = { window: 0, cooldown: 1, ready: 2 };
const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/** Misma lógica de estados que el MVP Timer original de HikariRO. */
export function spawnState(spawn: MvpSpawn, now: number): SpawnState {
  const { killedAt, minAt, maxAt } = spawn;
  if (killedAt === null || minAt === null) return { key: 'ready', remaining: null, progress: 100 };

  if (now < minAt) {
    const duration = Math.max(1, minAt - killedAt);
    return {
      key: 'cooldown',
      remaining: minAt - now,
      progress: clampPercent(((now - killedAt) * 100) / duration),
    };
  }
  if (maxAt !== null && now < maxAt) {
    const variance = Math.max(1, maxAt - minAt);
    return {
      key: 'window',
      remaining: maxAt - now,
      progress: clampPercent(((now - minAt) * 100) / variance),
    };
  }
  return { key: 'ready', remaining: null, progress: 100 };
}

function compareSpawns(a: SpawnView, b: SpawnView): number {
  return (
    priority[a.state.key] - priority[b.state.key] ||
    (a.minAt ?? 0) - (b.minAt ?? 0) ||
    a.map.localeCompare(b.map)
  );
}

export function toMvpView(mvp: Mvp, now: number): MvpView {
  const spawns = mvp.spawns
    .map((spawn) => ({ ...spawn, state: spawnState(spawn, now) }))
    .sort(compareSpawns);
  const best = spawns[0]?.state ?? { key: 'ready' as const, remaining: null, progress: 100 };
  return {
    ...mvp,
    spawns,
    state: best,
    activeSpawns: spawns.filter((spawn) => spawn.state.key !== 'ready').length,
  };
}

/** Primero los que pueden salir ya, luego los que están en espera; el resto por nombre. */
export function sortMvpViews(views: MvpView[]): MvpView[] {
  return [...views].sort((a, b) => {
    const byState = priority[a.state.key] - priority[b.state.key];
    if (byState) return byState;
    if (a.state.key !== 'ready') return (a.spawns[0]?.minAt ?? 0) - (b.spawns[0]?.minAt ?? 0);
    return a.name.localeCompare(b.name);
  });
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const clock = [
    Math.floor((seconds % 86_400) / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return days ? `${days}d ${clock}` : clock;
}

export type MvpFilter = 'all' | SpawnStateKey | 'favorites' | 'alerts';

interface FilterOptions {
  filter: MvpFilter;
  query: string;
  favorites: ReadonlySet<number>;
  /** MVPs con avisos (Windows, Telegram o ambos). */
  alerted?: ReadonlySet<number>;
}

const byMvp = new Set<MvpFilter>(['all', 'favorites', 'alerts']);

export function filterMvps(
  views: MvpView[],
  { filter, query, favorites, alerted = new Set() }: FilterOptions,
): MvpView[] {
  const needle = query.trim().toLowerCase();
  return views.flatMap((mvp) => {
    if (filter === 'favorites' && !favorites.has(mvp.id)) return [];
    if (filter === 'alerts' && !alerted.has(mvp.id)) return [];
    const nameMatches = mvp.name.toLowerCase().includes(needle);
    const spawns = mvp.spawns.filter(
      (spawn) =>
        (!needle || nameMatches || spawn.map.toLowerCase().includes(needle)) &&
        (byMvp.has(filter) || spawn.state.key === filter),
    );
    return spawns.length ? [{ ...mvp, spawns }] : [];
  });
}
