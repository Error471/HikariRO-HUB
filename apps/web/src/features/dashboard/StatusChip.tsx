import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/cn';
import { DIAGNOSTICS_REFRESH_MS, diagnosticsQuery } from '@/features/diagnostics/diagnostics';

/** Estado de HikariRO en una línea: todo bien, sin conexión o con cambios en su web. */
export function StatusChip() {
  const { data } = useQuery({ ...diagnosticsQuery, refetchInterval: DIAGNOSTICS_REFRESH_MS });
  if (!data) return null;

  const states = data.modules.map((module) => module.state);
  const status = states.includes('changed')
    ? { label: 'HikariRO ha cambiado', hint: 'HikariRO ha cambiado su web', dot: 'bg-gold-400' }
    : states.includes('unavailable')
      ? { label: 'HikariRO no responde', hint: 'HikariRO no responde', dot: 'bg-ember-400' }
      : { label: 'HikariRO', hint: 'HikariRO funciona', dot: 'bg-leaf-400' };

  return (
    <Link
      to="/diagnostico"
      title={`${status.hint} · Ver diagnóstico`}
      aria-label={`${status.hint}. Ver diagnóstico`}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink-muted transition hover:bg-white/5 hover:text-ink"
    >
      <span aria-hidden="true" className={cn('size-2 rounded-full', status.dot)} />
      {status.label}
    </Link>
  );
}
