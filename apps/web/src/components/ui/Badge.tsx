import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'gold' | 'mana' | 'neutral';

const tones: Record<Tone, string> = {
  gold: 'bg-gold-400/12 text-gold-300 ring-gold-400/30',
  mana: 'bg-mana-400/12 text-mana-300 ring-mana-400/30',
  neutral: 'bg-white/5 text-ink-muted ring-white/10',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
