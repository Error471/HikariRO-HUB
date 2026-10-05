import type { Mvp } from '@hikari-hub/shared';
import { describe, expect, it } from 'vitest';
import { toMvpView } from '@/features/mvp/mvp-status';
import { pickDashboardMvps } from './MvpWidget';

const now = 1_000_000;
const mvp = (id: number, killedAt: number | null): Mvp => ({
  id,
  name: `MVP ${id}`,
  imageUrl: '',
  detailUrl: '',
  spawns: [
    {
      map: 'map',
      killedAt,
      minAt: killedAt === null ? null : killedAt + 3600,
      maxAt: killedAt === null ? null : killedAt + 4200,
    },
  ],
});
const views = [mvp(1, null), mvp(2, now - 100), mvp(3, now - 3700)].map((m) => toMvpView(m, now));

describe('pickDashboardMvps', () => {
  it('muestra los MVPs seguidos, incluso si están disponibles', () => {
    const result = pickDashboardMvps(views, new Set([1, 2]));
    expect(result.mine.map((m) => m.id)).toEqual([2, 1]);
    expect(result.upcoming.map((m) => m.id)).toEqual([3]);
  });

  it('completa con los próximos en salir', () => {
    const result = pickDashboardMvps(views, new Set());
    expect(result.mine).toEqual([]);
    expect(result.upcoming.map((m) => m.id)).toEqual([3, 2]);
  });
});
