import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-white/10 px-6 py-12 text-center">
      <Icon aria-hidden="true" className="size-8 text-ink-faint" />
      <p className="mt-4 font-medium">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
    </div>
  );
}
