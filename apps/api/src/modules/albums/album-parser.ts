import type { AlbumCard, AlbumProgress, Fish } from '@hrc/shared';
import * as cheerio from 'cheerio';
import { AppError } from '../../lib/app-error.js';

/** "1.468" / "43.13" → número (los miles usan punto en las cartas, los decimales en la pesca). */
function parseInteger(text: string | undefined): number | null {
  const digits = (text ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

function parseDecimal(text: string | undefined): number | null {
  const match = /(\d+(?:[.,]\d+)?)/.exec(text ?? '');
  return match?.[1] ? Number(match[1].replace(',', '.')) : null;
}

function itemIdFromPath(path: string | undefined): number | null {
  const match = /\/items\/(?:images|icons)\/(\d+)\.png/.exec(path ?? '');
  return match?.[1] ? Number(match[1]) : null;
}

export interface CardPage {
  progress: AlbumProgress;
  results: number;
  pages: number;
  cards: AlbumCard[];
}

/** Página de `?module=cartaslog` (20 cartas por página). */
export function parseCardAlbum(html: string, baseUrl: string): CardPage {
  const $ = cheerio.load(html);
  const album = $('.hro-card-album');
  if (album.length === 0) throw new AppError('UPSTREAM_CHANGED');

  const progressText = album.find('.hro-card-album__progress-info span').first().text();
  const progressMatch = /([\d.]+)\s+de\s+([\d.]+)/.exec(progressText);
  const info = album.find('.info-text').first().text();
  const infoMatch = /total de\s+([\d.]+)\s+registro.*?en\s+(\d+)\s+página/i.exec(info);

  const cards = album
    .find('.hro-card-album__card')
    .toArray()
    .flatMap((card) => {
      const element = $(card);
      const id =
        parseInteger(/ID:\s*(\d+)/.exec(element.find('.hro-card-album__meta').text())?.[1]) ??
        itemIdFromPath(element.find('img').attr('src'));
      if (id === null) return [];
      return [
        {
          id,
          name: element.find('.hro-card-album__name').text().trim(),
          imageUrl: `${baseUrl}/data/items/images/${id}.png`,
          iconUrl: `${baseUrl}/data/items/icons/${id}.png`,
          detailUrl: `${baseUrl}/?module=item&action=view&id=${id}`,
          obtained: element.hasClass('is-found'),
        },
      ];
    });

  return {
    progress: {
      obtained: parseInteger(progressMatch?.[1]) ?? 0,
      total: parseInteger(progressMatch?.[2]) ?? 0,
    },
    results: parseInteger(infoMatch?.[1]) ?? cards.length,
    pages: Number(infoMatch?.[2] ?? 1),
    cards,
  };
}

const STAR_FILLED = '★';

/** Página de `?module=fishingalbum` (todas las especies en una sola página). */
export function parseFishingAlbum(
  html: string,
  baseUrl: string,
): { progress: AlbumProgress; fish: Fish[] } {
  const $ = cheerio.load(html);
  const album = $('.fish-album');
  if (album.length === 0) throw new AppError('UPSTREAM_CHANGED');

  const head = /(\d+)\s*\/\s*(\d+)/.exec(album.find('.fish-head').text());
  const fish = album
    .find('.fish-card')
    .toArray()
    .map((card): Fish => {
      const element = $(card);
      const src = element.find('img').attr('src') ?? '';
      const itemId = itemIdFromPath(src);
      const imageUrl = itemId
        ? `${baseUrl}/data/items/images/${itemId}.png`
        : src.startsWith('data:image/')
          ? src
          : '';

      if (element.hasClass('locked')) return { discovered: false, imageUrl };

      const [measures = '', record = ''] = (element.find('.fish-meta').html() ?? '').split(
        /<br\s*\/?>/i,
      );
      const [size, weight] = cheerio.load(measures).text().split('·');
      const [catches, map] = cheerio.load(record).text().split('·');
      const bestMap = map?.trim() ?? '';

      return {
        discovered: true,
        itemId,
        name: element.find('h4').text().trim(),
        imageUrl,
        iconUrl: itemId ? `${baseUrl}/data/items/icons/${itemId}.png` : null,
        stars: [...element.find('.fish-stars').text()].filter((char) => char === STAR_FILLED)
          .length,
        sizeCm: parseDecimal(size),
        weightKg: parseDecimal(weight),
        catches: parseInteger(catches),
        bestMap: bestMap && bestMap.toLowerCase() !== 'unknown' ? bestMap : null,
      };
    });

  return {
    progress: {
      obtained: Number(head?.[1] ?? fish.filter((entry) => entry.discovered).length),
      total: Number(head?.[2] ?? fish.length),
    },
    fish,
  };
}
