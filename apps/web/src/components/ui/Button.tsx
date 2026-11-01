import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'subtle';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-night-950 font-medium hover:bg-gold-400 active:translate-y-px',
  subtle: 'border border-ink/12 text-ink hover:border-ink',
  ghost: 'text-ink-muted hover:text-ink hover:bg-white/5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-xs font-medium uppercase tracking-[0.08em] transition duration-300 disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
