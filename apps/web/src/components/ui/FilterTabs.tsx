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

/** Grupo de filtros excluyentes con scroll horizontal en móvil. */
export function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition',
              active
                ? 'border-gold-400/50 bg-gold-400/12 text-gold-200'
                : 'border-white/8 text-ink-muted hover:border-white/15 hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn('tabular-nums text-xs', active ? 'text-gold-300' : 'text-ink-faint')}
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
