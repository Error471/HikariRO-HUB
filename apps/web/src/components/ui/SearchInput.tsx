import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function SearchInput({ label, className, ...props }: SearchInputProps) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 w-full rounded-full border border-white/10 bg-night-950/50 pr-4 pl-11 shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)] transition-colors text-base placeholder:text-ink-faint focus:border-gold-400/60 focus:outline-none focus:ring-2 focus:ring-gold-400/25 sm:text-sm"
        {...props}
      />
    </label>
  );
}
