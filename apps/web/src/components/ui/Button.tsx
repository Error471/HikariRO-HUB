import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'subtle';

const variants: Record<Variant, string> = {
  primary:
    'bg-linear-to-b from-gold-300 to-gold-400 font-semibold text-night-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_rgb(0_0_0/0.5),0_10px_28px_-14px_rgb(240_169_75/0.7)] hover:from-gold-200 hover:to-gold-300 active:scale-[0.985]',
  subtle:
    'border border-white/10 bg-white/[0.035] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] hover:border-white/18 hover:bg-white/[0.07] active:scale-[0.985]',
  ghost: 'text-ink-muted hover:text-ink hover:bg-white/5',
};

/** Clases de un enlace con aspecto de botón secundario (mismo aspecto que `variant="subtle"`). */
export const subtleButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4.5 text-sm font-medium text-ink-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-[color,background-color,border-color,scale] duration-200 hover:border-white/18 hover:bg-white/[0.07] hover:text-ink active:scale-[0.985]';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5.5 text-sm font-medium transition-[color,background-color,border-color,scale] duration-200 disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
