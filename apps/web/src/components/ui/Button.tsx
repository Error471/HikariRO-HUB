import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'subtle';

const variants: Record<Variant, string> = {
  primary:
    'bg-gold-400 text-night-950 font-semibold shadow-glow hover:bg-gold-300 active:translate-y-px',
  subtle: 'bg-night-800 text-ink hover:bg-night-700 border border-white/8',
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
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm transition duration-200 disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
