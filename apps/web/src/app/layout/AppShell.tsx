import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { Brand } from '@/components/ui/Brand';
import { SESSION_REFRESH_MS, sessionQuery } from '@/features/auth/session';
import { StatusChip } from '@/features/dashboard/StatusChip';
import { UpstreamBanner } from '@/features/diagnostics/UpstreamBanner';
import { CommandPaletteProvider, SearchButton } from '@/features/search/CommandPalette';
import { useSpotlight } from '@/hooks/useSpotlight';
import { MobileNav } from './MobileNav';
import { NavLinks } from './NavLinks';
import { SessionExpiredDialog } from './SessionExpiredDialog';
import { UserPanel } from './UserPanel';

export function AppShell({ username }: { username: string }) {
  const { data } = useQuery({ ...sessionQuery, refetchInterval: SESSION_REFRESH_MS });
  const expired = data?.status === 'anonymous' && data.reason === 'expired';
  useSpotlight();

  return (
    <CommandPaletteProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16.75rem_minmax(0,1fr)]">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-lg bg-gold-400 px-4 py-2 text-night-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>

        {/* Menú lateral flotante: panel con sus propios bordes, separado del borde de la ventana. */}
        <aside className="panel sticky top-3 my-3 ml-3 hidden h-[calc(100dvh-1.5rem)] flex-col gap-6 overflow-y-auto rounded-[1.4rem] p-3 lg:flex">
          <Link to="/" aria-label="Ir al dashboard" className="rounded-xl px-2 pt-2.5 pb-1">
            <Brand />
          </Link>
          <NavLinks />
          <div className="mt-auto">
            <UserPanel username={username} />
          </div>
        </aside>

        <MobileNav username={username} />

        <div className="min-w-0">
          {/* Barra superior de escritorio: búsqueda global y estado siempre a mano. */}
          <div className="sticky top-0 z-20 hidden h-16 items-center gap-2 bg-night-900/70 px-10 backdrop-blur-xl lg:flex">
            {/* Buscador en píldora con doble aro. */}
            <div className="w-full max-w-md rounded-full bg-white/[0.03] p-1 ring-1 ring-white/6">
              <SearchButton className="flex min-h-9 w-full items-center gap-2.5 rounded-full border border-white/8 bg-night-950/60 px-4 text-sm text-ink-faint shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)] transition-colors hover:border-white/16 hover:text-ink-muted pointer-coarse:min-h-11" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <StatusChip />
              <a
                href="https://hikariro.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 pointer-coarse:min-h-11 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
              >
                Web oficial
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </div>
          </div>

          <main
            id="contenido"
            className="mx-auto w-full min-w-0 max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12"
          >
            <UpstreamBanner />
            <Outlet />
          </main>
        </div>

        <SessionExpiredDialog open={expired} />
      </div>
    </CommandPaletteProvider>
  );
}
