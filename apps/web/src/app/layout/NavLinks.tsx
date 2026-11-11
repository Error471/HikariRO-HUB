import { Link } from '@tanstack/react-router';
import { dashboardLink, navigation, type ModuleDefinition } from '../navigation';

const linkBase =
  'group relative flex min-h-10 pointer-coarse:min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-ink-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink';
const linkActive =
  'bg-white/[0.08] font-medium text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.07)] [&_svg]:text-gold-300 [&_svg]:opacity-100 before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-gold-400';
const iconClass = 'size-4.5 shrink-0 opacity-75 transition-opacity group-hover:opacity-100';

function ModuleLink({ item, onNavigate }: { item: ModuleDefinition; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      className={linkBase}
      activeProps={{ className: linkActive, 'aria-current': 'page' }}
    >
      <Icon aria-hidden="true" className={iconClass} />
      <span className="truncate">{item.label}</span>
      {!item.available && (
        <span className="ml-auto text-xs font-medium uppercase tracking-wider text-ink-faint">
          Fase {item.phase}
        </span>
      )}
    </Link>
  );
}

/** Navegación principal compartida por el sidebar de escritorio y el drawer móvil. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const DashboardIcon = dashboardLink.icon;
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-0.5">
      <Link
        to={dashboardLink.path}
        onClick={onNavigate}
        className={linkBase}
        activeOptions={{ exact: true }}
        activeProps={{ className: linkActive, 'aria-current': 'page' }}
      >
        <DashboardIcon aria-hidden="true" className={iconClass} />
        {dashboardLink.label}
      </Link>

      {navigation.map((group) => {
        const grouped = group.items.length > 1;
        return (
          <div
            key={group.id}
            role="group"
            aria-labelledby={grouped ? `nav-${group.id}` : undefined}
            className={grouped ? 'mt-4 mb-2' : undefined}
          >
            {grouped && (
              <p
                id={`nav-${group.id}`}
                className="mb-1 px-3 text-xs font-medium uppercase tracking-[0.16em] text-ink-faint"
              >
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <ModuleLink item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
