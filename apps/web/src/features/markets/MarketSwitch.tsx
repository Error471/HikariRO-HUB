import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { marketMeta } from './market-meta';

const tabClass =
  'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap text-ink-muted transition hover:text-ink';
const activeClass = 'bg-night-600 text-gold-200 shadow-sm';

/** Conmutador entre Vending, Buying Store y la búsqueda unificada. */
export function MarketSwitch() {
  return (
    <nav
      aria-label="Mercados"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/8 bg-night-850/80 p-1 [scrollbar-width:none]"
    >
      {Object.values(marketMeta).map((meta) => {
        const Icon = meta.icon;
        return (
          <Link
            key={meta.type}
            to={meta.path}
            className={tabClass}
            activeOptions={{ includeSearch: false }}
            activeProps={{ className: activeClass, 'aria-current': 'page' }}
          >
            <Icon aria-hidden="true" className="size-4" />
            {meta.label}
          </Link>
        );
      })}
      <Link
        to="/mercados/buscar"
        search={{ q: '' }}
        className={tabClass}
        activeOptions={{ includeSearch: false }}
        activeProps={{ className: activeClass, 'aria-current': 'page' }}
      >
        <Search aria-hidden="true" className="size-4" />
        Buscar item
      </Link>
    </nav>
  );
}
