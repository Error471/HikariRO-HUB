import { Link } from '@tanstack/react-router';
import { CloudOff, Wrench } from 'lucide-react';
import { ApiError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  fallbackUrl?: string;
}

const isUpstreamChange = (error: unknown) =>
  error instanceof ApiError && error.code === 'UPSTREAM_CHANGED';

export function ErrorState({ error, onRetry, fallbackUrl }: ErrorStateProps) {
  // HikariRO ha cambiado su web: no es un fallo pasajero, así que se explica y se enlaza al diagnóstico.
  const changed = isUpstreamChange(error);
  const Icon = changed ? Wrench : CloudOff;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-card border px-6 py-12 text-center',
        changed ? 'border-gold-400/25 bg-gold-400/5' : 'border-ember-400/20 bg-ember-400/5',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('size-8', changed ? 'text-gold-300' : 'text-ember-400')}
      />
      {changed && (
        <p className="mt-4 font-display text-lg font-semibold text-ink">
          HikariRO ha cambiado su web
        </p>
      )}
      <p className={cn('max-w-md text-sm', changed ? 'mt-2 text-ink-muted' : 'mt-4 text-ink')}>
        {changed
          ? 'Esta sección no se puede mostrar hasta que Hikari Hub se actualice. Mientras tanto puedes verla en la web oficial.'
          : errorMessage(error)}
      </p>
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
        {changed && (
          <Link
            to="/diagnostico"
            className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm text-gold-300 hover:text-gold-200"
          >
            Ver diagnóstico
          </Link>
        )}
      </div>
    </div>
  );
}
