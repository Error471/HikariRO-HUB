import type { AlertConfigResponse, LeadMinutes } from '@hikari-hub/shared';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, BellRing, ExternalLink, Monitor, Pause, Play, Send, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useMvpAlerts, type TestChannel } from './alerts';

const leadOptions: { value: LeadMinutes; label: string }[] = [
  { value: 0, label: 'Al abrirse la ventana' },
  { value: 5, label: '5 min antes' },
  { value: 10, label: '10 min antes' },
  { value: 15, label: '15 min antes' },
];

const inputClass =
  'min-h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-3 text-base text-ink placeholder:text-ink-faint focus:border-gold-400/60 focus:outline-none sm:text-sm';

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

function Section({
  title,
  icon: Icon,
  status,
  children,
}: {
  title: string;
  icon: typeof Bell;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-white/6 pt-5 first:border-t-0 first:pt-0">
      <h3 className="flex items-center justify-between gap-3 font-display text-base font-semibold">
        <span className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4.5 text-gold-300" />
          {title}
        </span>
        {status}
      </h3>
      {children}
    </section>
  );
}

function StatusPill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        ok ? 'bg-leaf-400/10 text-leaf-400 ring-leaf-400/30' : 'text-ink-faint ring-white/10',
      )}
    >
      {children}
    </span>
  );
}

const notify = (promise: Promise<unknown>, success: string) =>
  void promise
    .then(() => toast.success(success))
    .catch((error: unknown) => toast.error(errorMessage(error)));

function useTest() {
  const { sendTest } = useMvpAlerts();
  return {
    pending: sendTest.isPending,
    run: (channel: TestChannel) =>
      notify(sendTest.mutateAsync(channel), 'Aviso de prueba enviado.'),
  };
}

// --- General ---

function GeneralSection({ config }: { config: AlertConfigResponse }) {
  const { update } = useMvpAlerts();
  const values = Object.values(config.channels);
  const byWindows = values.filter((channel) => channel !== 'telegram').length;
  const byTelegram = values.filter((channel) => channel !== 'windows').length;

  return (
    <Section
      title="General"
      icon={BellRing}
      status={
        <StatusPill ok={config.enabled}>{config.enabled ? 'Activos' : 'En pausa'}</StatusPill>
      }
    >
      <p className="text-sm text-ink-muted">
        {values.length === 0
          ? 'Todavía no has marcado ningún MVP. Pulsa la campana de un MVP para elegir cómo avisarte.'
          : `${values.length} ${values.length === 1 ? 'MVP marcado' : 'MVPs marcados'}: ${byWindows} por Windows y ${byTelegram} por Telegram.`}
      </p>
      {config.enabled && values.length > 0 && !config.watching && (
        <Notice tone="warn">
          Los avisos están en pausa porque tu sesión de HikariRO caducó. Vuelve a iniciar sesión
          para reactivarlos.
        </Notice>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">¿Cuándo avisar?</span>
        <div role="group" aria-label="Momento del aviso" className="grid grid-cols-2 gap-2">
          {leadOptions.map((option) => {
            const active = option.value === config.leadMinutes;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update.mutate(
                    { leadMinutes: option.value },
                    { onError: (error) => toast.error(errorMessage(error)) },
                  )
                }
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
      <Button
        variant="ghost"
        className="self-start"
        disabled={update.isPending}
        onClick={() =>
          notify(
            update.mutateAsync({ enabled: !config.enabled }),
            config.enabled ? 'Avisos en pausa.' : 'Avisos reanudados.',
          )
        }
      >
        {config.enabled ? (
          <Pause aria-hidden="true" className="size-4" />
        ) : (
          <Play aria-hidden="true" className="size-4" />
        )}
        {config.enabled ? 'Pausar todos los avisos' : 'Reanudar los avisos'}
      </Button>
    </Section>
  );
}

// --- Windows ---

function WindowsSection({ config }: { config: AlertConfigResponse }) {
  const test = useTest();
  return (
    <Section
      title="Windows"
      icon={Monitor}
      status={
        <StatusPill ok={config.windowsAvailable}>
          {config.windowsAvailable ? 'Disponible' : 'No disponible'}
        </StatusPill>
      }
    >
      {config.windowsAvailable ? (
        <>
          <p className="text-sm text-ink-muted">
            Notificaciones del sistema, también con la ventana cerrada mientras Hikari Hub siga
            junto al reloj.
          </p>
          <Button
            variant="subtle"
            className="self-start"
            disabled={test.pending}
            onClick={() => test.run('windows')}
          >
            <Send aria-hidden="true" className="size-4" />
            Probar en Windows
          </Button>
        </>
      ) : (
        <Notice>Las notificaciones de Windows solo funcionan en la app de escritorio.</Notice>
      )}
    </Section>
  );
}

// --- Telegram ---

function TokenForm() {
  const { connectTelegram } = useMvpAlerts();
  const [token, setToken] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    notify(
      connectTelegram.mutateAsync(token.trim()).then(() => setToken('')),
      'Bot conectado.',
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-muted">
        <li>
          En Telegram abre{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mana-400 underline-offset-2 hover:underline"
          >
            @BotFather
          </a>
          , envía <code className="text-ink">/newbot</code> y sigue los pasos.
        </li>
        <li>Copia el token que te da (parece 123456789:AAH…) y pégalo aquí.</li>
      </ol>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Token del bot
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="123456789:AAH…"
          className={inputClass}
        />
      </label>
      <Button
        type="submit"
        className="self-start"
        disabled={connectTelegram.isPending || token.trim().length < 20}
      >
        {connectTelegram.isPending ? <Spinner /> : <Send aria-hidden="true" className="size-4" />}
        Conectar bot
      </Button>
      <p className="text-xs text-ink-faint">
        El token se guarda cifrado solo en este PC y nunca se muestra de nuevo.
      </p>
    </form>
  );
}

function ChatLinker({ botName }: { botName: string }) {
  const { detectTelegramChat, linkTelegramChat } = useMvpAlerts();
  const [chatId, setChatId] = useState('');
  const handle = botName.replace(/^@/, '');

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-muted" start={3}>
        <li>
          Abre{' '}
          <a
            href={`https://t.me/${encodeURIComponent(handle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-mana-400 underline-offset-2 hover:underline"
          >
            {botName} <ExternalLink aria-hidden="true" className="size-3" />
          </a>{' '}
          y pulsa <strong className="text-ink">Iniciar</strong> (o envíale cualquier mensaje).
        </li>
        <li>Vuelve aquí y pulsa «Detectar chat».</li>
      </ol>
      <Button
        className="self-start"
        disabled={detectTelegramChat.isPending}
        onClick={() => notify(detectTelegramChat.mutateAsync(), 'Telegram vinculado.')}
      >
        {detectTelegramChat.isPending ? (
          <Spinner />
        ) : (
          <Send aria-hidden="true" className="size-4" />
        )}
        Detectar chat
      </Button>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">
          ¿Prefieres un grupo o canal? Escribe su ID
        </summary>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            notify(linkTelegramChat.mutateAsync(chatId.trim()), 'Telegram vinculado.');
          }}
        >
          <input
            aria-label="ID del chat"
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            placeholder="-1001234567890 o @micanal"
            className={inputClass}
          />
          <Button
            type="submit"
            variant="subtle"
            disabled={linkTelegramChat.isPending || !chatId.trim()}
          >
            Vincular
          </Button>
        </form>
        <p className="mt-2 text-xs text-ink-faint">
          Añade antes el bot al grupo o canal (en un canal, como administrador).
        </p>
      </details>
    </div>
  );
}

function TelegramSection({ config }: { config: AlertConfigResponse }) {
  const { disconnectTelegram } = useMvpAlerts();
  const test = useTest();
  const { configured, botName, chatLinked } = config.telegram;

  return (
    <Section
      title="Telegram"
      icon={Send}
      status={
        <StatusPill ok={chatLinked}>
          {chatLinked ? 'Conectado' : configured ? 'Falta vincular' : 'Sin configurar'}
        </StatusPill>
      }
    >
      {!configured ? (
        <TokenForm />
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            Bot: <strong className="text-ink">{botName}</strong>
            {chatLinked && ' · los avisos llegan a tu chat con el bot.'}
          </p>
          {chatLinked ? (
            <Button
              variant="subtle"
              className="self-start"
              disabled={test.pending}
              onClick={() => test.run('telegram')}
            >
              <Send aria-hidden="true" className="size-4" />
              Probar en Telegram
            </Button>
          ) : (
            <ChatLinker botName={botName ?? 'tu bot'} />
          )}
          <Button
            variant="ghost"
            className="self-start"
            disabled={disconnectTelegram.isPending}
            onClick={() => notify(disconnectTelegram.mutateAsync(), 'Telegram desconectado.')}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Quitar el bot
          </Button>
        </>
      )}
    </Section>
  );
}

// --- Diálogo ---

function DialogBody() {
  const { config } = useMvpAlerts();
  if (config.isPending) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
        <Spinner /> Cargando configuración…
      </p>
    );
  }
  if (!config.data) {
    return <Notice tone="warn">{errorMessage(config.error)}</Notice>;
  }
  return (
    <>
      <GeneralSection config={config.data} />
      <WindowsSection config={config.data} />
      <TelegramSection config={config.data} />
    </>
  );
}

/** Configuración de los avisos de MVP: antelación, Windows y bot de Telegram. */
export function NotificationsDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-ink-muted transition hover:border-white/20 hover:text-ink">
        <Bell aria-hidden="true" className="size-4" />
        Avisos
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-night-950/80 backdrop-blur-sm data-[state=open]:animate-fade" />
        <Dialog.Content className="panel fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-card p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-xl font-semibold">
                Avisos de MVP
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-muted">
                Pulsa la campana de cada MVP para elegir si te avisamos por Windows, por Telegram,
                por ambos o por ninguno.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Cerrar"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-white/5 hover:text-ink"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <DialogBody />
          <p className="text-xs text-ink-faint">
            Los avisos usan tu sesión de HikariRO y solo funcionan mientras Hikari Hub está abierto
            (aunque sea junto al reloj).
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
