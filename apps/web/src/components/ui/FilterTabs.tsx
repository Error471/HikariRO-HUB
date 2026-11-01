import { cn } from '@/lib/cn';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Grupo de filtros excluyentes; pasa a varias líneas si no caben. */
export function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-5 text-xs uppercase tracking-[0.1em] transition',
              active
                ? 'border-ink bg-ink text-night-950'
                : 'border-ink/12 text-ink-muted hover:border-ink hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn('tabular-nums text-xs', active ? 'text-night-700' : 'text-ink-faint')}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
