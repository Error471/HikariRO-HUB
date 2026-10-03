import { describe, expect, it } from 'vitest';
import {
  parseNumber,
  parsePageCount,
  parseShopDetail,
  parseShopList,
} from '../src/modules/markets/market-parser.js';
import { findOffers, normalizeText, rankOffers } from '../src/modules/markets/market-search.js';
import { fixture, HIKARI } from './helpers.js';

describe('parseNumber', () => {
  it('interpreta precios y cantidades de HikariRO', () => {
    expect(parseNumber('10.000.000 z')).toBe(10_000_000);
    expect(parseNumber('x5414')).toBe(5414);
    expect(parseNumber('')).toBeNull();
  });
});

describe('parseShopList', () => {
  it('extrae las tiendas con propietario y ubicación', () => {
    const shops = parseShopList(fixture('vending-list.html'), 'vending', HIKARI);
    expect(shops).toEqual([
      {
        id: 1,
        type: 'vending',
        title: 'Llevele Llevele',
        owner: 'Ayla',
        map: 'veil',
        x: 110,
        y: 110,
        sourceUrl: `${HIKARI}/?module=vending&action=viewshop&id=1`,
      },
      expect.objectContaining({ id: 4, owner: 'Black Viernes', x: 113, y: 108 }),
    ]);
  });

  it('lee el número de páginas', () => {
    expect(parsePageCount(fixture('vending-list.html'))).toBe(1);
    expect(parsePageCount('<div class="hro-shop-toolbar">… en 3 página(s).</div>')).toBe(3);
  });
});

describe('parseShopDetail', () => {
  it('extrae cantidades, precios y ranuras', () => {
    const items = parseShopDetail(fixture('vending-shop-1.html'), HIKARI);
    expect(items).toEqual([
      expect.objectContaining({
        itemId: 6672,
        name: 'Gray Shard',
        amount: 5414,
        unitPrice: 25_555,
        slots: null,
        refine: null,
        iconUrl: `${HIKARI}/data/items/icons/6672.png`,
      }),
      expect.objectContaining({ itemId: 820004, amount: 1, slots: 2, unitPrice: 10_000_000 }),
    ]);
  });

  it('extrae refinado y cartas insertadas', () => {
    const [item] = parseShopDetail(fixture('vending-shop-4.html'), HIKARI) ?? [];
    expect(item).toMatchObject({
      refine: 15,
      slots: 1,
      extras: [
        {
          label: 'Cartas',
          entries: [
            { itemId: 4485, name: 'Sealed Gloom Under Night Card' },
            { itemId: 310533, name: 'Wolf Orb (Angle Shot)' },
          ],
        },
      ],
    });
  });

  it('lee la cantidad solicitada en las tiendas de compra', () => {
    const [item] = parseShopDetail(fixture('buying-shop-1.html'), HIKARI) ?? [];
    expect(item).toMatchObject({ itemId: 6635, amount: 160, unitPrice: 130_000 });
  });

  it('detecta tiendas cerradas', () => {
    expect(parseShopDetail(fixture('shop-not-found.html'), HIKARI)).toBeNull();
  });
});

describe('búsqueda', () => {
  const [ayla, windhawk] = parseShopList(fixture('vending-list.html'), 'vending', HIKARI);
  if (!ayla || !windhawk) throw new Error('Fixture de vending incompleta');
  const shops = [
    {
      ...windhawk,
      items: parseShopDetail(fixture('vending-shop-4.html'), HIKARI) ?? [],
    },
    {
      ...ayla,
      items: parseShopDetail(fixture('vending-shop-1.html'), HIKARI) ?? [],
    },
  ];

  it('ignora mayúsculas y tildes', () => {
    expect(normalizeText('Écharpe ÁÉ')).toBe('echarpe ae');
  });

  it('encuentra items por nombre y por cartas insertadas', () => {
    expect(findOffers(shops, 'gray').map((o) => o.item.name)).toEqual([
      'Gray Wolf Suit',
      'Gray Shard',
    ]);
    expect(findOffers(shops, 'wolf orb').map((o) => o.item.name)).toEqual(['Gray Wolf Suit']);
  });

  it('ordena las ventas de más barata a más cara', () => {
    const ranked = rankOffers(findOffers(shops, 'gray'), 'asc');
    expect(ranked.map((o) => o.item.unitPrice)).toEqual([25_555, 450_000_000]);
    expect(ranked[0]?.shop).not.toHaveProperty('items');
  });
});
