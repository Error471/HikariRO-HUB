import { useId } from 'react';
import { cn } from '@/lib/cn';

export function Emblem({ className }: { className?: string }) {
  // Id único por instancia: un <defs> dentro de un SVG oculto no se puede referenciar.
  const gradientId = useId();
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-9 shrink-0', className)}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8e2b0" />
          <stop offset="1" stopColor="#c9902f" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#131729" />
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="13.5"
        fill="none"
        stroke="rgb(242 205 132 / 0.35)"
      />
      <path
        d="M32 8l5.2 15.6L52 26l-12.2 8.6L44 50 32 41.2 20 50l4.2-15.4L12 26l14.8-2.4z"
        fill={`url(#${gradientId})`}
      />
      <circle cx="32" cy="30" r="4.5" fill="#131729" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <Emblem />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[1.05rem] font-bold tracking-wide text-gold-300">
            HikariRO
          </span>
          <span className="block text-[0.68rem] font-medium uppercase tracking-[0.28em] text-ink-faint">
            Companion
          </span>
        </span>
      )}
    </span>
  );
}
