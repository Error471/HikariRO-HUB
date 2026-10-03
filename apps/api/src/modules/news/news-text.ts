const TITLE_MAX = 140;
const SUMMARY_MAX = 220;

/** Quita menciones, emojis personalizados y marcas de formato de Discord. */
export function discordToPlainText(markdown: string): string {
  return markdown
    .replace(/@(everyone|here)\b/g, '')
    .replace(/<a?:(\w+):\d+>/g, '')
    .replace(/<@[!&]?\d+>|<#\d+>/g, '')
    .replace(/<t:\d+(?::\w)?>/g, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/^\s{0,3}(#{1,3}|>|-#)\s+/gm, '')
    .replace(/(\*\*|__|~~|\|\||`)/g, '')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1$2');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Contenido sin la línea usada como título (ni las menciones previas), para no repetirlo. */
export function bodyWithoutTitle(markdown: string): string {
  const lines = markdown.split('\n');
  const titleIndex = lines.findIndex((line) => discordToPlainText(line).trim() !== '');
  return titleIndex === -1
    ? ''
    : lines
        .slice(titleIndex + 1)
        .join('\n')
        .trim();
}

/** Discord no tiene título: se usa la primera línea con texto y el resto como resumen. */
export function extractTitleAndSummary(markdown: string, author: string) {
  const lines = discordToPlainText(markdown)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const [first, ...rest] = lines;
  return {
    title: first ? truncate(first, TITLE_MAX) : `Publicación de ${author}`,
    summary: truncate(rest.join(' '), SUMMARY_MAX),
  };
}
