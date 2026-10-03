import { CloudOff } from 'lucide-react';
import { errorMessage } from '@/lib/api-client';
import { Button } from './Button';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  fallbackUrl?: string;
}

export function ErrorState({ error, onRetry, fallbackUrl }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-card border border-ember-400/20 bg-ember-400/5 px-6 py-12 text-center"
    >
      <CloudOff aria-hidden="true" className="size-8 text-ember-400" />
      <p className="mt-4 max-w-md text-sm text-ink">{errorMessage(error)}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button variant="subtle" onClick={onRetry}>
            Reintentar
          </Button>
        )}
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm text-ink-muted hover:text-ink"
          >
            Ver en HikariRO
          </a>
        )}
      </div>
    </div>
  );
}
