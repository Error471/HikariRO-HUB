import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Cabecera de página compacta: deja el contenido a la vista sin tener que desplazarse. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="kicker mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl leading-none tracking-tight text-ink text-balance sm:text-[2.75rem]">
          {title}
        </h1>
        {description && <p className="mt-2.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
