import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/cn';
import { dashboardLink, navigation, type ModuleDefinition } from '../navigation';

const linkBase =
  'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-ink-muted transition-colors duration-150 hover:bg-white/5 hover:text-ink';
const linkActive =
  'bg-gradient-to-r from-gold-400/14 to-transparent text-gold-200 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-gold-400';

function ModuleLink({ item, onNavigate }: { item: ModuleDefinition; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      className={linkBase}
      activeProps={{ className: linkActive, 'aria-current': 'page' }}
    >
      <Icon aria-hidden="true" className="size-4.5 shrink-0 opacity-80 group-hover:opacity-100" />
      <span className="truncate">{item.label}</span>
      {!item.available && (
        <span className="ml-auto text-[0.65rem] font-medium uppercase tracking-wider text-ink-faint">
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
    <nav aria-label="Navegación principal" className="flex flex-col gap-5">
      <Link
        to={dashboardLink.path}
        onClick={onNavigate}
        className={linkBase}
        activeOptions={{ exact: true }}
        activeProps={{ className: linkActive, 'aria-current': 'page' }}
      >
        <DashboardIcon aria-hidden="true" className="size-4.5 shrink-0" />
        {dashboardLink.label}
      </Link>

      {navigation.map((group) => {
        const grouped = group.items.length > 1;
        return (
          <div
            key={group.id}
            role="group"
            aria-labelledby={grouped ? `nav-${group.id}` : undefined}
          >
            {grouped && (
              <p
                id={`nav-${group.id}`}
                className="mb-1.5 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-ink-faint"
              >
                {group.label}
              </p>
            )}
            <ul
              className={cn(
                'flex flex-col gap-0.5',
                grouped && 'border-l border-white/6 ml-3 pl-1.5',
              )}
            >
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
