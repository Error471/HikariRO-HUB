import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PaginationProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}

/** Páginas visibles alrededor de la actual, con la primera y la última siempre presentes. */
export function visiblePages(page: number, pages: number): (number | 'gap')[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => {
    const previous = sorted[index - 1];
    return previous !== undefined && value - previous > 1 ? (['gap', value] as const) : [value];
  });
}

const button =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm tabular-nums transition disabled:pointer-events-none disabled:opacity-40';

export function Pagination({ page, pages, onChange }: PaginationProps) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-1">
      <button
        type="button"
        className={cn(button, 'text-ink-muted hover:bg-white/5 hover:text-ink')}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      {visiblePages(page, pages).map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-faint">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-label={`Página ${entry}`}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(
              button,
              entry === page
                ? 'bg-gold-400/15 font-semibold text-gold-200 ring-1 ring-gold-400/40'
                : 'text-ink-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(button, 'text-ink-muted hover:bg-white/5 hover:text-ink')}
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Página siguiente"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}
