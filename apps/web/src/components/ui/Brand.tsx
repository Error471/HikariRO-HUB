import { cn } from '@/lib/cn';

/** Marca de Hikari Hub: una h cuya pata derecha, con el punto de luz, se lee también como "hi". */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-9 shrink-0', className)}>
      <rect width="64" height="64" rx="14" fill="#18181c" />
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="13.5"
        fill="none"
        stroke="rgb(255 255 255 / 0.08)"
      />
      <path
        d="M22 14v36M22 36c0-5.5 4.5-10 10-10s10 4.5 10 10v14"
        fill="none"
        stroke="#ececee"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="14" r="4.5" fill="#d9a94f" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <Emblem />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[1.05rem] font-semibold tracking-tight text-ink">
            Hikari Hub
          </span>
          <span className="block text-xs text-ink-faint">para HikariRO</span>
        </span>
      )}
    </span>
  );
}
