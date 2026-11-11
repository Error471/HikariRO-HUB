import { Link, Outlet } from '@tanstack/react-router';
import { Brand } from '@/components/ui/Brand';
import { subtleButtonClass } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

/** Marco de las páginas que se pueden ver sin cuenta (la wiki local): solo marca y acceso. */
export function PublicShell() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink/12 bg-night-850/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link to="/wiki" aria-label="Ir a la wiki" className="rounded-xl">
            <Brand />
          </Link>
          <Link to="/login" className={cn(subtleButtonClass, 'min-h-10 text-ink')}>
            Iniciar sesión
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 pt-6 pb-12 sm:px-6 lg:px-10 lg:pt-10">
        <Outlet />
      </main>
    </div>
  );
}
