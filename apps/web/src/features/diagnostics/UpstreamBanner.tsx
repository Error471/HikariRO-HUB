import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { changedModules, DIAGNOSTICS_REFRESH_MS, diagnosticsQuery } from './diagnostics';

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`;
}

/** Aviso global cuando HikariRO ha cambiado su web y alguna sección no se puede leer. */
export function UpstreamBanner() {
  const { data } = useQuery({ ...diagnosticsQuery, refetchInterval: DIAGNOSTICS_REFRESH_MS });
  const changed = changedModules(data);
  if (changed.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-card border border-gold-400/30 bg-gold-400/8 p-4 text-sm sm:flex-row sm:items-center"
    >
      <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-gold-300" />
      <p className="flex-1 text-ink">
        <strong className="font-semibold">HikariRO ha cambiado su web.</strong>{' '}
        <span className="text-ink-muted">
          {joinLabels(changed)} no se {changed.length > 1 ? 'pueden' : 'puede'} mostrar ahora mismo.
          El resto de la app sigue funcionando.
        </span>
      </p>
      <Link
        to="/diagnostico"
        className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 font-medium text-gold-300 hover:bg-gold-400/10 hover:text-gold-200"
      >
        Ver diagnóstico
      </Link>
    </div>
  );
}
