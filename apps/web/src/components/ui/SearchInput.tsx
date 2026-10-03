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
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 w-full rounded-xl border border-white/10 bg-night-950/50 pr-3 pl-10 text-base placeholder:text-ink-faint focus:border-gold-400/50 focus:outline-none sm:text-sm"
        {...props}
      />
    </label>
  );
}
