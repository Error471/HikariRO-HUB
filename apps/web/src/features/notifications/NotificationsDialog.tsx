import type { LeadMinutes } from '@hrc/shared';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, BellOff, BellRing, Send, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { usePushNotifications } from './push';

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

function DeviceStatus() {
  const { config, support, permission, subscribedHere, enable, disable } = usePushNotifications();

  if (config.isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
        <Spinner /> Comprobando avisos…
      </p>
    );
  }
  if (!config.data?.enabled || !config.data.publicKey) {
    return <Notice>Los avisos no están configurados en este servidor.</Notice>;
  }
  if (support === 'needs-install') {
    return (
      <Notice>
        En iPhone o iPad, añade el Companion a la pantalla de inicio (Compartir → Añadir a pantalla
        de inicio) y ábrelo desde ahí para activar los avisos.
      </Notice>
    );
  }
  if (support === 'unsupported') {
    return <Notice>Este navegador no admite notificaciones push.</Notice>;
  }
  if (permission === 'denied') {
    return (
      <Notice tone="warn">
        Las notificaciones están bloqueadas para este sitio. Permítelas en los ajustes del navegador
        y vuelve a abrir esta ventana.
      </Notice>
    );
  }

  const publicKey = config.data.publicKey;
  const busy = enable.isPending || disable.isPending;
  const run = (action: () => Promise<unknown>, success: string) =>
    void action()
      .then(() => toast.success(success))
      .catch((error: unknown) => toast.error(errorMessage(error)));

  return subscribedHere ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-leaf-400/30 bg-leaf-400/8 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-ink">
        <BellRing aria-hidden="true" className="size-4 text-leaf-400" />
        Activados en este dispositivo
      </span>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => run(() => disable.mutateAsync(), 'Avisos desactivados en este dispositivo.')}
      >
        <BellOff aria-hidden="true" className="size-4" />
        Desactivar
      </Button>
    </div>
  ) : (
    <Button
      className="w-full"
      disabled={busy}
      onClick={() => run(() => enable.mutateAsync(publicKey), 'Avisos activados.')}
    >
      {busy ? <Spinner /> : <Bell aria-hidden="true" className="size-4" />}
      Activar en este dispositivo
    </Button>
  );
}

function Preferences({ favoritesCount }: { favoritesCount: number }) {
  const { config, subscribedHere, setLeadMinutes, sendTest } = usePushNotifications();
  if (!config.data?.enabled || !config.data.endpoints.length) return null;

  const changeLead = (value: LeadMinutes) =>
    setLeadMinutes.mutate(value, { onError: (error) => toast.error(errorMessage(error)) });

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
      {subscribedHere && (
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
      )}
    </div>
  );
}

/** Configuración de los avisos push de MVPs favoritos. */
export function NotificationsDialog({ favoritesCount }: { favoritesCount: number }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-gold-400/40 hover:text-ink">
        <Bell aria-hidden="true" className="size-4" />
        Avisos
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-night-950/80 backdrop-blur-sm data-[state=open]:animate-fade" />
        <Dialog.Content className="frame-gold fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-card p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-xl font-bold">Avisos de MVP</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                Te avisamos cuando un MVP favorito está a punto de salir, aunque tengas la app
                cerrada.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-white/5 hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <DeviceStatus />
          <Preferences favoritesCount={favoritesCount} />
          <p className="text-xs text-ink-faint">
            Los avisos usan tu sesión del Companion: si pasas más de 2 días sin entrar se pausan y
            te avisaremos para que vuelvas a iniciar sesión.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
