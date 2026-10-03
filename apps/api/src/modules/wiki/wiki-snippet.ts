import * as cheerio from 'cheerio';

const MATCH_START = '\u0001';
const MATCH_END = '\u0002';

function decodeEntities(text: string): string {
  return cheerio.load(`<p>${text}</p>`, null, false)('p').text();
}

/**
 * Los snippets de la búsqueda de MediaWiki mezclan wikitexto y HTML escapado.
 * Se convierten en texto plano troceado en coincidencias, sin HTML.
 */
export function parseSnippet(raw: string): { text: string; match: boolean }[] {
  const marked = raw
    .replace(/<span class=['"]searchmatch['"]>/g, MATCH_START)
    .replace(/<\/span>/g, MATCH_END)
    .replace(/<[^>]*>/g, '');

  const plain = decodeEntities(marked)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/^[=*#:;|!{}-]+|[=]{2,}/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const segments: { text: string; match: boolean }[] = [];
  for (const part of plain.split(MATCH_START)) {
    const [matched, rest] = part.includes(MATCH_END) ? part.split(MATCH_END, 2) : [null, part];
    if (matched) segments.push({ text: matched, match: true });
    if (rest) segments.push({ text: rest, match: false });
  }
  return segments.filter((segment) => segment.text.length > 0);
}
