import * as Dialog from '@radix-ui/react-dialog';
import { Link, useNavigate } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useDeleteAccountData } from '@/features/auth/session';
import { errorMessage } from '@/lib/api-client';

/** Confirmación para borrar todo lo que Hikari Hub guarda de la cuenta. */
export function DeleteDataDialog() {
  const remove = useDeleteAccountData();
  const navigate = useNavigate();

  const confirm = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success('Tus datos se han borrado y se ha cerrado la sesión.');
        void navigate({ to: '/login' });
      },
      onError: (error) => toast.error(errorMessage(error)),
    });

  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Borrar mis datos"
        title="Borrar mis datos"
        className="grid size-10 place-items-center rounded-lg text-ink-muted transition hover:bg-white/5 hover:text-ember-400"
      >
        <Trash2 aria-hidden="true" className="size-4.5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-night-950/80 backdrop-blur-sm data-[state=open]:animate-fade" />
        <Dialog.Content className="panel fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card p-6 shadow-2xl">
          <span className="grid size-12 place-items-center rounded-full bg-ember-400/12 text-ember-400">
            <Trash2 aria-hidden="true" className="size-6" />
          </span>
          <Dialog.Title className="font-display text-xl font-semibold">
            ¿Borrar tus datos?
          </Dialog.Title>
          <Dialog.Description asChild>
            <div className="flex flex-col gap-2 text-sm text-ink-muted">
              <p>Se eliminará todo lo que Hikari Hub guarda de tu cuenta en este PC:</p>
              <ul className="list-disc pl-5">
                <li>Tus MVPs favoritos.</li>
                <li>Los avisos de MVP.</li>
                <li>Tu sesión guardada en este PC (también se cierra en HikariRO).</li>
              </ul>
              <p>
                Tu cuenta de HikariRO no se modifica. Más detalles en{' '}
                <Link to="/privacidad" className="text-mana-400 underline-offset-2 hover:underline">
                  Privacidad y cómo funciona
                </Link>
                .
              </p>
            </div>
          </Dialog.Description>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={remove.isPending}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button
              onClick={confirm}
              disabled={remove.isPending}
              className="bg-none bg-ember-400/90 text-night-950 shadow-none hover:bg-ember-400"
            >
              {remove.isPending ? <Spinner /> : <Trash2 aria-hidden="true" className="size-4" />}
              Borrar mis datos
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
