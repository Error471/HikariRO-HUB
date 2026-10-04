import { Fragment, type ReactNode } from 'react';

/*
 * Renderizado del markdown de Discord a elementos React (sin innerHTML):
 * todo el texto pasa por el escape de React, así que el contenido externo no puede inyectar HTML.
 */

const timestampFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' });

interface InlineRule {
  pattern: RegExp;
  render: (match: RegExpExecArray, key: string) => ReactNode;
}

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function link(href: string | null, label: ReactNode, key: string): ReactNode {
  if (!href) return label;
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="break-words text-mana-400 underline-offset-2 hover:underline"
    >
      {label}
    </a>
  );
}

const inlineRules: InlineRule[] = [
  {
    pattern: /`([^`\n]+)`/,
    render: (m, k) => (
      <code key={k} className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.85em]">
        {m[1]}
      </code>
    ),
  },
  {
    pattern: /\*\*(.+?)\*\*/,
    render: (m, k) => (
      <strong key={k} className="font-semibold text-ink">
        {inline(m[1] ?? '', k)}
      </strong>
    ),
  },
  {
    pattern: /__(.+?)__/,
    render: (m, k) => (
      <span key={k} className="underline">
        {inline(m[1] ?? '', k)}
      </span>
    ),
  },
  { pattern: /~~(.+?)~~/, render: (m, k) => <s key={k}>{inline(m[1] ?? '', k)}</s> },
  { pattern: /\|\|(.+?)\|\|/, render: (m, k) => <span key={k}>{inline(m[1] ?? '', k)}</span> },
  {
    pattern: /(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])/,
    render: (m, k) => <em key={k}>{inline(m[1] ?? '', k)}</em>,
  },
  {
    pattern: /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/,
    render: (m, k) => link(safeHref(m[2] ?? ''), m[1], k),
  },
  {
    pattern: /https?:\/\/[^\s<>()]+[^\s<>().,!?:;'"]/,
    render: (m, k) => link(safeHref(m[0]), m[0], k),
  },
  {
    pattern: /<t:(\d+)(?::\w)?>/,
    render: (m, k) => <time key={k}>{timestampFormat.format(new Date(Number(m[1]) * 1000))}</time>,
  },
  { pattern: /<a?:(\w+):\d+>/, render: () => null },
  { pattern: /<@[!&]?\d+>|<#\d+>|@everyone|@here/, render: () => null },
];

/** Busca la regla que empieza antes en el texto y la aplica de forma recursiva. */
export function inline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let index = 0;

  while (rest) {
    let best: { match: RegExpExecArray; rule: InlineRule } | null = null;
    for (const rule of inlineRules) {
      const match = rule.pattern.exec(rest);
      if (match && (!best || match.index < best.match.index)) best = { match, rule };
    }
    if (!best) {
      nodes.push(rest);
      break;
    }
    if (best.match.index > 0) nodes.push(rest.slice(0, best.match.index));
    nodes.push(best.rule.render(best.match, `${keyPrefix}-${index++}`));
    rest = rest.slice(best.match.index + best.match[0].length);
  }
  return nodes;
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'subtext' | 'paragraph' | 'quote'; lines: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'code'; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const last = blocks.at(-1);

    if (line.trimStart().startsWith('```')) {
      const code: string[] = [];
      while (++i < lines.length && !(lines[i] ?? '').trimStart().startsWith('```'))
        code.push(lines[i] ?? '');
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]?.length as 1 | 2 | 3,
        text: heading[2] ?? '',
      });
      continue;
    }

    const item = /^\s*(?:[-*•])\s+(.*)$/.exec(line);
    if (item) {
      if (last?.type === 'list') last.items.push(item[1] ?? '');
      else blocks.push({ type: 'list', items: [item[1] ?? ''] });
      continue;
    }

    const special = /^(-#|>)\s?(.*)$/.exec(line);
    const type = special ? (special[1] === '>' ? 'quote' : 'subtext') : 'paragraph';
    const text = special ? (special[2] ?? '') : line;

    if (!line.replace(/@everyone|@here|<@[!&]?\d+>/g, '').trim()) {
      blocks.push({ type: 'paragraph', lines: [] });
      continue;
    }
    if (last && last.type === type && 'lines' in last && last.lines.length) last.lines.push(text);
    else blocks.push({ type, lines: [text] });
  }
  return blocks.filter((block) => !('lines' in block) || block.lines.length > 0);
}

function linesWithBreaks(lines: string[], key: string): ReactNode {
  return lines.map((line, index) => (
    <Fragment key={`${key}-${index}`}>
      {index > 0 && <br />}
      {inline(line, `${key}-${index}`)}
    </Fragment>
  ));
}

const headingClass = {
  1: 'font-display text-xl font-semibold text-ink',
  2: 'font-display text-lg font-semibold text-ink',
  3: 'font-semibold text-ink',
} as const;

interface DiscordMarkdownProps {
  content: string;
  /** Texto si no hay contenido; `null` para no mostrar nada. */
  emptyText?: string | null;
}

export function DiscordMarkdown({
  content,
  emptyText = 'Publicación sin texto.',
}: DiscordMarkdownProps) {
  const blocks = parseBlocks(content);
  if (blocks.length === 0) {
    return emptyText ? <p className="text-ink-muted italic">{emptyText}</p> : null;
  }

  return (
    <div className="flex flex-col gap-3 leading-relaxed text-ink-muted">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case 'heading':
            return (
              <p
                key={key}
                role="heading"
                aria-level={block.level + 1}
                className={headingClass[block.level]}
              >
                {inline(block.text, key)}
              </p>
            );
          case 'list':
            return (
              <ul key={key} className="flex list-disc flex-col gap-1 pl-5 marker:text-gold-400">
                {block.items.map((itemText, itemIndex) => (
                  <li key={`${key}-${itemIndex}`}>{inline(itemText, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            );
          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-lg bg-night-950/70 p-3 font-mono text-sm"
              >
                {block.text}
              </pre>
            );
          case 'quote':
            return (
              <blockquote key={key} className="border-l-2 border-gold-400/50 pl-3">
                {linesWithBreaks(block.lines, key)}
              </blockquote>
            );
          case 'subtext':
            return (
              <p key={key} className="text-xs text-ink-faint">
                {linesWithBreaks(block.lines, key)}
              </p>
            );
          default:
            return <p key={key}>{linesWithBreaks(block.lines, key)}</p>;
        }
      })}
    </div>
  );
}
