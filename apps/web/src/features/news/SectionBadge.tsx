import type { NewsSection } from '@hrc/shared';
import { cn } from '@/lib/cn';
import { sectionMeta } from './news-query';

export function SectionBadge({ section }: { section: NewsSection }) {
  const { label, icon: Icon, tone } = sectionMeta[section];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tone,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
