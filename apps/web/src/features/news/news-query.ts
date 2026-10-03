import { newsListResponseSchema, type NewsSection } from '@hrc/shared';
import { queryOptions } from '@tanstack/react-query';
import { CalendarDays, GitBranch, Megaphone, MessageSquare, type LucideIcon } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

export const newsQuery = queryOptions({
  queryKey: ['news'],
  queryFn: ({ signal }) => apiRequest('/news', { schema: newsListResponseSchema, signal }),
  staleTime: 60_000,
});

export const sectionMeta: Record<NewsSection, { label: string; icon: LucideIcon; tone: string }> = {
  noticias: {
    label: 'Noticias',
    icon: Megaphone,
    tone: 'text-gold-300 bg-gold-400/12 ring-gold-400/30',
  },
  eventos: {
    label: 'Eventos',
    icon: CalendarDays,
    tone: 'text-ember-400 bg-ember-400/10 ring-ember-400/30',
  },
  changelog: {
    label: 'Changelog',
    icon: GitBranch,
    tone: 'text-mana-300 bg-mana-400/12 ring-mana-400/30',
  },
  otros: { label: 'Discord', icon: MessageSquare, tone: 'text-ink-muted bg-white/5 ring-white/10' },
};
