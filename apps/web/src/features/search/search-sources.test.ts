import type { MarketSearchResponse, Mvp } from '@hikari-hub/shared';
import { describe, expect, it } from 'vitest';
import { matches, searchMvps, searchTitles, summarizeItems } from './search-sources';

const mvp = (id: number, name: string, map: string): Mvp => ({
  id,
  name,
  imageUrl: `https://img/${id}.gif`,
  detailUrl: '',
  spawns: [{ map, killedAt: null, minAt: null, maxAt: null }],
});

describe('búsqueda global', () => {
  it('ignora tildes, mayúsculas y orden de las palabras', () => {
    expect(matches('Álbum de Pesca', 'pesca album')).toBe(true);
    expect(matches('Wiki', 'mercado')).toBe(false);
  });

  it('busca MVPs por nombre o mapa y junta los repetidos', () => {
    const mvps = [
      mvp(1, 'Baphomet', 'prt_maze03'),
      mvp(2, 'Drake', 'treasure02'),
      mvp(1, 'Baphomet', 'gef_dun02'),
    ];
    expect(searchMvps(mvps, 'baph')).toEqual([
      { id: 1, name: 'Baphomet', imageUrl: 'https://img/1.gif', maps: ['prt_maze03', 'gef_dun02'] },
    ]);
    expect(searchMvps(mvps, 'treasure').map((r) => r.name)).toEqual(['Drake']);
    expect(searchMvps(mvps, '  ')).toEqual([]);
  });

  it('pone primero los títulos que empiezan por la búsqueda', () => {
    expect(searchTitles(['Guía de cartas', 'Cartas MVP', 'Pesca'], 'cartas')).toEqual([
      'Cartas MVP',
      'Guía de cartas',
    ]);
  });

  it('resume los objetos del mercado con el mejor precio', () => {
    const item = (itemId: number, name: string, unitPrice: number) => ({
      item: {
        itemId,
        name,
        iconUrl: '',
        detailUrl: '',
        refine: null,
        slots: null,
        amount: 1,
        unitPrice,
        extras: [],
      },
      shop: {
        id: 1,
        type: 'vending' as const,
        title: '',
        owner: '',
        map: '',
        x: null,
        y: null,
        sourceUrl: '',
      },
    });
    const data: MarketSearchResponse = {
      query: 'potion',
      updatedAt: '',
      vending: [
        item(504, 'White Potion', 1200),
        item(504, 'White Potion', 1100),
        item(501, 'Red Potion', 50),
      ],
      buying: [item(504, 'White Potion', 1000)],
    };
    expect(summarizeItems(data)).toEqual([
      { itemId: 501, name: 'Red Potion', iconUrl: '', lowestSell: 50, highestBuy: null },
      { itemId: 504, name: 'White Potion', iconUrl: '', lowestSell: 1100, highestBuy: 1000 },
    ]);
  });
});
