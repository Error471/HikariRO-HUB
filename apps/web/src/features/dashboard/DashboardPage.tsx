import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { modules, type ModuleDefinition } from '@/app/navigation';
import { Badge } from '@/components/ui/Badge';
import { MarketSearchBox } from '@/features/markets/MarketSearchBox';
import { MvpWidget } from './MvpWidget';
import { NewsWidget } from './NewsWidget';

const moreModules = [
  modules.vending,
  modules.buyingStore,
  modules.wiki,
  modules.cards,
  modules.fishing,
];

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 6 || hour >= 21) return 'Buenas noches';
  if (hour < 14) return 'Buenos días';
  return 'Buenas tardes';
}

function ModuleTile({ module }: { module: ModuleDefinition }) {
  const Icon = module.icon;
  return (
    <Link
      to={module.path}
      className="group flex h-full flex-col rounded-card border border-white/7 bg-night-850/80 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-gold-400/35 hover:bg-night-800"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-gold-400/18 to-mana-400/8 text-gold-300 ring-1 ring-gold-400/20">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        {module.available ? (
          <Badge tone="mana">Disponible</Badge>
        ) : (
          <Badge>Fase {module.phase}</Badge>
        )}
      </div>
      <h3 className="mt-4 font-display font-semibold tracking-wide group-hover:text-gold-200">
        {module.label}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
        {module.description}
      </p>
    </Link>
  );
}

export function DashboardPage({ username }: { username: string }) {
  return (
    <div className="flex flex-col gap-8 animate-rise">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-muted">{greeting()},</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide text-balance sm:text-4xl">
            {username}
          </h1>
        </div>
        <a
          href="https://hikariro.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-gold-400/40 hover:text-ink sm:self-auto"
        >
          Web oficial
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </section>

      <MarketSearchBox />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <MvpWidget />
        <NewsWidget />
      </div>

      <section aria-labelledby="dash-modules">
        <h2
          id="dash-modules"
          className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-ink-faint"
        >
          Más módulos
          <span
            aria-hidden="true"
            className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"
          />
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {moreModules.map((module) => (
            <ModuleTile key={module.id} module={module} />
          ))}
        </div>
      </section>
    </div>
  );
}
