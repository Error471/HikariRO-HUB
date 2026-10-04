import { ArrowUpRight, Construction } from 'lucide-react';
import { navigation, type ModuleDefinition } from '@/app/navigation';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';

function sectionLabel(module: ModuleDefinition): string {
  const group = navigation.find((candidate) => candidate.items.includes(module));
  return group && group.items.length > 1 ? group.label : 'HikariRO';
}

/**
 * Página de un módulo aún no integrado. Mantiene la navegación dentro de la app
 * y ofrece la página original de HikariRO como respaldo.
 */
export function ModulePage({ module }: { module: ModuleDefinition }) {
  const Icon = module.icon;
  return (
    <div className="flex flex-col gap-8 animate-rise">
      <PageHeader
        eyebrow={sectionLabel(module)}
        title={module.label}
        description={module.description}
        actions={<Badge>Fase {module.phase}</Badge>}
      />

      <section className="flex flex-col items-center rounded-card border border-dashed border-white/12 bg-night-850/50 px-6 py-14 text-center">
        <span className="relative grid size-16 place-items-center rounded-2xl bg-night-700 text-gold-300 ring-1 ring-white/8">
          <Icon aria-hidden="true" className="size-7" />
          <Construction
            aria-hidden="true"
            className="absolute -right-2 -bottom-2 size-6 rounded-full bg-night-850 p-1 text-mana-400"
          />
        </span>
        <h2 className="mt-5 font-display text-xl font-semibold">En construcción</h2>
        <p className="mt-2 max-w-md text-sm text-ink-muted">
          Este módulo se integrará en la fase {module.phase} del proyecto. Mientras tanto puedes
          consultarlo en la web de HikariRO.
        </p>
        <a
          href={module.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink transition hover:border-white/20"
        >
          Ver en HikariRO
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </section>
    </div>
  );
}
