import type { LeadMinutes } from '@hikari-hub/shared';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, BellOff, BellRing, Send, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useMvpAlerts } from './alerts';

const leadOptions: { value: LeadMinutes; label: string }[] = [
  { value: 0, label: 'Al abrirse la ventana' },
  { value: 5, label: '5 min antes' },
  { value: 10, label: '10 min antes' },
  { value: 15, label: '15 min antes' },
];

function Notice({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return (
    <p
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        tone === 'warn'
          ? 'border-ember-400/30 bg-ember-400/8 text-ink'
          : 'border-white/8 bg-night-800/60 text-ink-muted',
      )}
    >
      {children}
    </p>
  );
}

function Status() {
  const { config, update } = useMvpAlerts();

  if (config.isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
        <Spinner /> Comprobando avisos…
      </p>
    );
  }
  if (!config.data?.available) {
    return <Notice>Los avisos solo funcionan en la app de escritorio de Hikari Hub.</Notice>;
  }

  const toggle = (enabled: boolean) =>
    update.mutate(
      { enabled },
      {
        onSuccess: () => toast.success(enabled ? 'Avisos activados.' : 'Avisos desactivados.'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  if (!config.data.enabled) {
    return (
      <Button className="w-full" disabled={update.isPending} onClick={() => toggle(true)}>
        {update.isPending ? <Spinner /> : <Bell aria-hidden="true" className="size-4" />}
        Activar avisos
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-leaf-400/30 bg-leaf-400/8 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-ink">
          <BellRing aria-hidden="true" className="size-4 text-leaf-400" />
          Avisos activados
        </span>
        <Button variant="ghost" disabled={update.isPending} onClick={() => toggle(false)}>
          <BellOff aria-hidden="true" className="size-4" />
          Desactivar
        </Button>
      </div>
      {!config.data.watching && (
        <Notice tone="warn">
          Los avisos están en pausa porque tu sesión de HikariRO caducó. Vuelve a iniciar sesión
          para reactivarlos.
        </Notice>
      )}
    </div>
  );
}

function Preferences({ favoritesCount }: { favoritesCount: number }) {
  const { config, update, sendTest } = useMvpAlerts();
  if (!config.data?.available || !config.data.enabled) return null;

  const changeLead = (leadMinutes: LeadMinutes) =>
    update.mutate({ leadMinutes }, { onError: (error) => toast.error(errorMessage(error)) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">¿Cuándo avisar?</span>
        <div role="group" aria-label="Momento del aviso" className="grid grid-cols-2 gap-2">
          {leadOptions.map((option) => {
            const active = option.value === config.data.leadMinutes;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => changeLead(option.value)}
                className={cn(
                  'min-h-11 rounded-xl border px-3 text-sm transition',
                  active
                    ? 'border-gold-400/50 bg-gold-400/12 text-gold-200'
                    : 'border-white/8 text-ink-muted hover:border-white/20 hover:text-ink',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {favoritesCount === 0 && (
        <Notice tone="warn">
          Todavía no tienes favoritos. Marca MVPs con la estrella para recibir sus avisos.
        </Notice>
      )}
      <Button
        variant="subtle"
        disabled={sendTest.isPending}
        onClick={() =>
          sendTest.mutate(undefined, {
            onSuccess: () => toast.success('Aviso de prueba enviado.'),
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      >
        <Send aria-hidden="true" className="size-4" />
        Enviar aviso de prueba
      </Button>
    </div>
  );
}

/** Configuración de los avisos de MVPs favoritos. */
export function NotificationsDialog({ favoritesCount }: { favoritesCount: number }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-white/20 hover:text-ink">
        <Bell aria-hidden="true" className="size-4" />
        Avisos
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-night-950/80 backdrop-blur-sm data-[state=open]:animate-fade" />
        <Dialog.Content className="panel fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-card p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-xl font-semibold">
                Avisos de MVP
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                Windows te avisa cuando un MVP favorito está a punto de salir, también con la
                ventana cerrada mientras Hikari Hub siga junto al reloj.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-white/5 hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <Status />
          <Preferences favoritesCount={favoritesCount} />
          <p className="text-xs text-ink-faint">
            Los avisos usan tu sesión de HikariRO. Si caduca, se pausan y te avisaremos para que
            vuelvas a iniciar sesión. Si cierras Hikari Hub desde el icono junto al reloj, no hay
            avisos hasta que la abras de nuevo.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
