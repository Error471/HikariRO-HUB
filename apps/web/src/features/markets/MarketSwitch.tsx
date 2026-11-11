import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { marketMeta } from './market-meta';

const tabClass =
  'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm whitespace-nowrap text-ink-muted transition-colors hover:text-ink pointer-coarse:min-h-11';
const activeClass =
  'bg-white/11 font-medium text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.4)] [&_svg]:text-gold-300';

/** Conmutador entre Vending, Buying Store y la búsqueda unificada. */
export function MarketSwitch() {
  return (
    <nav
      aria-label="Mercados"
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/8 bg-white/[0.025] p-1 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] [scrollbar-width:none]"
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
