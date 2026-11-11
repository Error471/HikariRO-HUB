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

/** Control segmentado de filtros excluyentes; pasa a varias líneas si no caben. */
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
      className="flex w-fit max-w-full min-w-0 flex-wrap gap-1 rounded-[1.4rem] border border-white/8 bg-white/[0.025] p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
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
              'inline-flex min-h-9 pointer-coarse:min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm transition-colors duration-150',
              active
                ? 'bg-white/11 font-medium text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.4)]'
                : 'text-ink-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'font-mono text-xs tabular-nums',
                  active ? 'text-gold-300' : 'text-ink-faint',
                )}
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
