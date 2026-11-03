import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadCloud } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api-client';
import { wikiStatusQuery } from './wiki-query';

// Última versión de la wiki que ya se ha visto: si cambia, lo guardado en pantalla está desfasado.
let seenVersion: string | null = null;

/**
 * La wiki no viene dentro de la app: se descarga de GitHub la primera vez que se abre.
 * Hasta que termina se muestra el avance; después se enseña el contenido.
 */
export function WikiGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const status = useQuery(wikiStatusQuery);
  const retry = useMutation({
    mutationFn: () => apiRequest('/wiki/download', { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: wikiStatusQuery.queryKey }),
  });

  const version = status.data?.version ?? null;
  useEffect(() => {
    if (version === null) return;
    // Una actualización en segundo plano trajo contenido nuevo: se descarta lo que había en memoria.
    if (seenVersion !== null && seenVersion !== version) {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'wiki' && query.queryKey[1] !== 'status',
      });
    }
    seenVersion = version;
  }, [version, queryClient]);

  if (status.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (status.error && !status.data) {
    return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  }

  const data = status.data;
  if (!data || data.state === 'ready') return children;

  const percent = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <div
      role={data.state === 'error' ? 'alert' : 'status'}
      className="panel mx-auto mt-8 flex max-w-lg flex-col items-center px-6 py-12 text-center animate-rise"
    >
      <DownloadCloud
        aria-hidden="true"
        className={
          data.state === 'error' ? 'size-8 text-ember-400' : 'size-8 animate-pulse text-gold-300'
        }
      />
      <h1 className="mt-4 font-display text-3xl">
        {data.state === 'error' ? 'No se ha podido descargar la wiki' : 'Descargando la wiki'}
      </h1>
      {data.state === 'error' ? (
        <>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">{data.message}</p>
          <Button
            className="mt-6"
            variant="subtle"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
          >
            Reintentar
          </Button>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-sm text-sm text-ink-muted">
            Solo ocurre la primera vez: se guarda en este PC y después se puede leer sin conexión.
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Progreso de la descarga"
            className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-ink/10"
          >
            <div
              className="h-full rounded-full bg-gold-400 transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs tabular-nums text-ink-faint">{percent}%</p>
        </>
      )}
    </div>
  );
}
