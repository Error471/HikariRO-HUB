import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

export function WikiBreadcrumbs({ items }: { items: ReactNode[] }) {
  return (
    <nav
      aria-label="Ruta de navegación"
      className="flex flex-wrap items-center gap-1 text-sm text-ink-muted"
    >
      <Link to="/wiki" className="hover:text-ink">
        Wiki
      </Link>
      {items.map((item, index) => (
        <Fragment key={index}>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
          <span className={index === items.length - 1 ? 'truncate text-ink-faint' : undefined}>
            {item}
          </span>
        </Fragment>
      ))}
    </nav>
  );
}
