import * as Dialog from '@radix-ui/react-dialog';
import { Link } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '@/components/ui/Brand';
import { dashboardLink, modules } from '../navigation';
import { NavLinks } from './NavLinks';
import { UserPanel } from './UserPanel';

const quickLinks = [dashboardLink, modules.mvp, modules.vending, modules.wiki] as const;

/** Barra superior + drawer con el menú completo + barra inferior de accesos rápidos (< lg). */
export function MobileNav({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/6 bg-night-900/85 px-4 backdrop-blur-md lg:hidden">
        <Link to="/" aria-label="Ir al dashboard">
          <Brand />
        </Link>
        <Dialog.Trigger
          aria-label="Abrir menú"
          className="grid size-11 place-items-center rounded-xl text-ink-muted hover:bg-white/5 hover:text-ink"
        >
          <Menu aria-hidden="true" className="size-5" />
        </Dialog.Trigger>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-night-950/70 backdrop-blur-sm data-[state=open]:animate-fade lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col gap-6 overflow-y-auto border-r border-white/8 bg-night-850 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl data-[state=open]:animate-[rise_300ms_ease-out] lg:hidden"
        >
          <div className="flex items-center justify-between">
            <Brand />
            <Dialog.Close
              aria-label="Cerrar menú"
              className="grid size-11 place-items-center rounded-xl text-ink-muted hover:bg-white/5"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">Menú principal</Dialog.Title>
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-auto">
            <UserPanel username={username} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      <nav
        aria-label="Accesos rápidos"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/6 bg-night-900/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              activeOptions={{ exact: item.path === '/' }}
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.68rem] text-ink-faint"
              activeProps={{ className: 'text-gold-300', 'aria-current': 'page' }}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="max-w-full truncate px-1">
                {item.path === '/' ? 'Inicio' : item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.68rem] text-ink-faint"
        >
          <Menu aria-hidden="true" className="size-5" />
          Más
        </button>
      </nav>
    </Dialog.Root>
  );
}
