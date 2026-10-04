import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Bloquea la app cuando HikariRO invalida la sesión y ofrece volver a entrar. */
export function SessionExpiredDialog({ open }: { open: boolean }) {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });

  const relogin = () => {
    void navigate({ to: '/login', search: { redirect: currentPath, reason: 'expired' } });
  };

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-night-950/80 backdrop-blur-sm data-[state=open]:animate-fade" />
        <Dialog.Content
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="panel fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card p-6 text-center shadow-2xl data-[state=open]:animate-rise"
        >
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-gold-400/12 text-gold-300">
            <Hourglass aria-hidden="true" className="size-6" />
          </span>
          <Dialog.Title className="font-display text-xl font-semibold">
            Tu sesión ha expirado
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-ink-muted">
            HikariRO ha cerrado tu sesión. Vuelve a iniciar sesión para seguir donde lo dejaste.
          </Dialog.Description>
          <Button className="mt-6 w-full" onClick={relogin} autoFocus>
            Iniciar sesión nuevamente
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
