import type { WikiNotice } from '@hikari-hub/shared';
import { Ban, Hammer, History, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const kinds: Record<WikiNotice['kind'], { icon: LucideIcon; className: string }> = {
  warn: { icon: TriangleAlert, className: 'border-ember-400/30 bg-ember-400/8 text-ember-400' },
  off: { icon: Ban, className: 'border-ember-400/30 bg-ember-400/8 text-ember-400' },
  build: { icon: Hammer, className: 'border-mana-400/30 bg-mana-400/8 text-mana-300' },
  old: { icon: History, className: 'border-white/12 bg-white/4 text-ink-muted' },
};

/** Aviso editorial de una página: desactualizada, en construcción, sistema o evento antiguo. */
export function WikiNoticeBox({ notice }: { notice: WikiNotice }) {
  const { icon: Icon, className } = kinds[notice.kind];
  return (
    <div role="note" className={cn('flex items-start gap-3 rounded-card border p-4', className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{notice.label}</p>
        <p className="text-ink-muted">{notice.text}</p>
      </div>
    </div>
  );
}
