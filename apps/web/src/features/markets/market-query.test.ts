import type { MarketShop } from '@hrc/shared';
import { describe, expect, it } from 'vitest';
import { formatZeny } from '@/lib/format';
import { normalizeText, shopTotals } from './market-query';

const item = (amount: number, unitPrice: number) => ({
  itemId: 1,
  name: 'Item',
  iconUrl: '',
  detailUrl: '',
  refine: null,
  slots: null,
  amount,
  unitPrice,
  extras: [],
});

describe('mercados', () => {
  it('suma unidades y valor total de una tienda', () => {
    const shop = { items: [item(5414, 25_555), item(1, 10_000_000)] } as unknown as MarketShop;
    expect(shopTotals(shop)).toEqual({ units: 5415, value: 148_354_770 });
  });

  it('formatea zeny con separador de miles también en 4 cifras', () => {
    expect(formatZeny(5414)).toBe('5.414 z');
    expect(formatZeny(10_000_000)).toBe('10.000.000 z');
  });

  it('normaliza texto para buscar sin tildes', () => {
    expect(normalizeText('  Poción Blanca ')).toBe('pocion blanca');
  });
});
