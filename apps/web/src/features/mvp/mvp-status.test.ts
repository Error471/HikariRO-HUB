import type { Mvp } from '@hikari-hub/shared';
import { describe, expect, it } from 'vitest';
import { filterMvps, formatCountdown, sortMvpViews, spawnState, toMvpView } from './mvp-status';

const NOW = 1_000_000;
const spawn = (map: string, killedAgo: number | null, min = 3600, max = 4200) => ({
  map,
  killedAt: killedAgo === null ? null : NOW - killedAgo,
  minAt: killedAgo === null ? null : NOW - killedAgo + min,
  maxAt: killedAgo === null ? null : NOW - killedAgo + max,
});
const mvp = (id: number, name: string, spawns: Mvp['spawns']): Mvp => ({
  id,
  name,
  imageUrl: '',
  detailUrl: '',
  spawns,
});

describe('spawnState', () => {
  it('sin muerte registrada → disponible', () => {
    expect(spawnState(spawn('a', null), NOW)).toEqual({
      key: 'ready',
      remaining: null,
      progress: 100,
    });
  });

  it('antes del mínimo → en espera con el tiempo restante', () => {
    expect(spawnState(spawn('a', 600), NOW)).toMatchObject({ key: 'cooldown', remaining: 3000 });
  });

  it('entre mínimo y máximo → ventana de respawn', () => {
    expect(spawnState(spawn('a', 3900), NOW)).toMatchObject({
      key: 'window',
      remaining: 300,
      progress: 50,
    });
  });

  it('pasado el máximo → disponible', () => {
    expect(spawnState(spawn('a', 5000), NOW).key).toBe('ready');
  });
});

describe('orden y filtros', () => {
  const views = [
    mvp(1, 'Zeta', [spawn('z1', null)]),
    mvp(2, 'Baphomet', [spawn('prt_maze03', 600)]),
    mvp(3, 'Arachne', [spawn('cave1', null), spawn('cave2', 3900)]),
    mvp(4, 'Amon Ra', [spawn('moc', null)]),
  ].map((item) => toMvpView(item, NOW));

  it('ordena: ventana, espera y luego disponibles por nombre', () => {
    expect(sortMvpViews(views).map((v) => v.name)).toEqual([
      'Arachne',
      'Baphomet',
      'Amon Ra',
      'Zeta',
    ]);
  });

  it('el estado del MVP es el de su spawn más relevante', () => {
    const arachne = views.find((v) => v.id === 3);
    expect(arachne?.state.key).toBe('window');
    expect(arachne?.activeSpawns).toBe(1);
    expect(arachne?.spawns[0]?.map).toBe('cave2');
  });

  it('filtra por estado, búsqueda por mapa y favoritos', () => {
    const favorites = new Set([4]);
    expect(
      filterMvps(views, { filter: 'cooldown', query: '', favorites }).map((v) => v.id),
    ).toEqual([2]);
    expect(filterMvps(views, { filter: 'all', query: 'cave2', favorites })[0]?.spawns).toHaveLength(
      1,
    );
    expect(
      filterMvps(views, { filter: 'favorites', query: '', favorites }).map((v) => v.id),
    ).toEqual([4]);
    expect(
      filterMvps(views, { filter: 'alerts', query: '', favorites, alerted: new Set([4]) }).map(
        (v) => v.id,
      ),
    ).toEqual([4]);
  });
});

describe('formatCountdown', () => {
  it('formatea horas y días', () => {
    expect(formatCountdown(3725)).toBe('01:02:05');
    expect(formatCountdown(90_061)).toBe('1d 01:01:01');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});
