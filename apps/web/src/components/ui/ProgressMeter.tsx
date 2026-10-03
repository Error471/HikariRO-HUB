import { formatCount } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ProgressMeterProps {
  label: string;
  obtained: number;
  total: number;
  unit: string;
  className?: string;
}

const percentFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export function ProgressMeter({ label, obtained, total, unit, className }: ProgressMeterProps) {
  const percent = total > 0 ? (obtained / total) * 100 : 0;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className="font-display text-lg font-semibold tabular-nums text-gold-200">
          {percentFormat.format(percent)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={obtained}
        aria-valuetext={`${obtained} de ${total} ${unit}`}
        className="h-2.5 overflow-hidden rounded-full bg-white/8"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-500 via-gold-400 to-gold-200 transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className="text-xs text-ink-faint tabular-nums">
        {formatCount(obtained)} de {formatCount(total)} {unit}
      </p>
    </div>
  );
}
