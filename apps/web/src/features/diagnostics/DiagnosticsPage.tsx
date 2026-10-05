import { upstreamModuleLabels, type ModuleHealth, type ModuleState } from '@hikari-hub/shared';
import { useQuery } from '@tanstack/react-query';
import {
  CircleCheck,
  CircleDashed,
  ClipboardCopy,
  RefreshCw,
  Trash2,
  Unplug,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import {
  DIAGNOSTICS_REFRESH_MS,
  diagnosticsQuery,
  diagnosticsText,
  moduleStateLabels,
  useClearJournal,
} from './diagnostics';

const stateStyle: Record<ModuleState, { icon: typeof CircleCheck; className: string }> = {
  ok: { icon: CircleCheck, className: 'text-leaf-400' },
  changed: { icon: Wrench, className: 'text-gold-300' },
  unavailable: { icon: Unplug, className: 'text-ember-400' },
  unknown: { icon: CircleDashed, className: 'text-ink-faint' },
};

const stateHelp: Record<ModuleState, string> = {
  ok: 'La última consulta funcionó.',
  changed: 'HikariRO responde con un formato nuevo. Hará falta actualizar Hikari Hub.',
  unavailable: 'HikariRO no respondió. Suele ser temporal (mantenimiento o conexión).',
  unknown: 'Todavía no has abierto esta sección.',
};

function ModuleRow({ module }: { module: ModuleHealth }) {
  const { icon: Icon, className } = stateStyle[module.state];
  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/6 bg-night-850/60 p-4">
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', className)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-medium text-ink">{upstreamModuleLabels[module.module]}</p>
          <p className={cn('text-sm font-medium', className)}>{moduleStateLabels[module.state]}</p>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{stateHelp[module.state]}</p>
        {module.checkedAt && (
          <p className="mt-1 text-xs text-ink-faint">
            Comprobado {formatRelative(module.checkedAt)}
          </p>
        )}
      </div>
    </li>
  );
}

export function DiagnosticsPage() {
  const { data, error, isPending, refetch, isFetching } = useQuery({
    ...diagnosticsQuery,
    refetchInterval: DIAGNOSTICS_REFRESH_MS,
  });
  const clear = useClearJournal();

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(diagnosticsText(data));
      toast.success('Diagnóstico copiado. Pégalo al reportar el problema.');
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto del registro y cópialo a mano.');
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-rise">
      <PageHeader
        eyebrow="Ayuda"
        title="Diagnóstico"
        description="Estado de cada sección de HikariRO y los últimos errores de la app. No incluye contraseñas, tokens ni datos de tu cuenta."
        actions={
          <>
            <Button variant="subtle" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw
                aria-hidden="true"
                className={cn('size-4', isFetching && 'animate-spin')}
              />
              Actualizar
            </Button>
            <Button onClick={() => void copy()} disabled={!data}>
              <ClipboardCopy aria-hidden="true" className="size-4" />
              Copiar diagnóstico
            </Button>
          </>
        }
      />

      {isPending ? (
        <Skeleton className="h-64" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <section aria-labelledby="diag-modules" className="flex flex-col gap-3">
            <h2 id="diag-modules" className="font-display text-lg font-semibold">
              Estado de HikariRO
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {data.modules.map((module) => (
                <ModuleRow key={module.module} module={module} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="diag-log" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="diag-log" className="font-display text-lg font-semibold">
                Registro de errores
              </h2>
              {data.entries.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    clear.mutate(undefined, {
                      onError: (mutationError) => toast.error(errorMessage(mutationError)),
                    })
                  }
                  disabled={clear.isPending}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Vaciar registro
                </Button>
              )}
            </div>
            {data.entries.length === 0 ? (
              <p className="rounded-xl border border-white/6 bg-night-850/60 p-4 text-sm text-ink-muted">
                Sin errores desde que se abrió la app.
              </p>
            ) : (
              <ol className="flex flex-col divide-y divide-white/6 rounded-xl border border-white/6 bg-night-850/60">
                {data.entries.map((entry, index) => (
                  <li
                    key={`${entry.time}-${index}`}
                    className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-4"
                  >
                    <time
                      dateTime={entry.time}
                      className="shrink-0 font-mono text-xs text-ink-faint sm:w-36"
                    >
                      {new Date(entry.time).toLocaleString('es-ES')}
                    </time>
                    <span
                      className={cn(
                        'shrink-0 text-xs font-semibold uppercase tracking-wider sm:w-14',
                        entry.level === 'error' ? 'text-ember-400' : 'text-gold-300',
                      )}
                    >
                      {entry.level === 'error' ? 'Error' : 'Aviso'}
                    </span>
                    <p className="min-w-0 break-words font-mono text-xs text-ink-muted">
                      {entry.message}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="text-xs text-ink-faint">
            Hikari Hub {data.version} · {data.platform} · en marcha desde{' '}
            {formatRelative(data.startedAt)}
          </p>
        </>
      )}
    </div>
  );
}
