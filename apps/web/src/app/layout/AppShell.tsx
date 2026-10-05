import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { Brand } from '@/components/ui/Brand';
import { SESSION_REFRESH_MS, sessionQuery } from '@/features/auth/session';
import { UpstreamBanner } from '@/features/diagnostics/UpstreamBanner';
import { CommandPaletteProvider, SearchButton } from '@/features/search/CommandPalette';
import { MobileNav } from './MobileNav';
import { HelpLinks, NavLinks } from './NavLinks';
import { SessionExpiredDialog } from './SessionExpiredDialog';
import { UserPanel } from './UserPanel';

export function AppShell({ username }: { username: string }) {
  const { data } = useQuery({ ...sessionQuery, refetchInterval: SESSION_REFRESH_MS });
  const expired = data?.status === 'anonymous' && data.reason === 'expired';

  return (
    <CommandPaletteProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-lg bg-gold-400 px-4 py-2 text-night-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>

        <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto border-r border-white/6 bg-night-850/70 p-4 backdrop-blur-sm lg:flex">
          <Link to="/" aria-label="Ir al dashboard" className="rounded-xl px-1 pt-2">
            <Brand />
          </Link>
          <SearchButton />
          <NavLinks />
          <div className="mt-auto flex flex-col gap-3">
            <HelpLinks />
            <UserPanel username={username} />
          </div>
        </aside>

        <MobileNav username={username} />

        <main
          id="contenido"
          className="mx-auto w-full min-w-0 max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12"
        >
          <UpstreamBanner />
          <Outlet />
        </main>

        <SessionExpiredDialog open={expired} />
      </div>
    </CommandPaletteProvider>
  );
}
