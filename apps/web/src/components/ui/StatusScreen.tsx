import type { ReactNode } from 'react';
import { Emblem } from './Brand';

interface StatusScreenProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  busy?: boolean;
}

/** Pantalla completa para carga inicial, errores globales y 404. */
export function StatusScreen({ title, description, action, busy = false }: StatusScreenProps) {
  return (
    <div
      className="grid min-h-dvh place-items-center px-4"
      aria-busy={busy || undefined}
      role={busy ? 'status' : undefined}
    >
      <div className="flex max-w-sm flex-col items-center text-center animate-fade">
        <Emblem className={busy ? 'size-14 animate-pulse' : 'size-14'} />
        <h1 className="mt-6 font-display text-2xl font-bold">{title}</h1>
        {description && <p className="mt-2 text-sm text-ink-muted">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
