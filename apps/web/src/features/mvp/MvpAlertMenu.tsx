import type { AlertConfigResponse } from '@hikari-hub/shared';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Bell, BellOff, BellRing, Check, Monitor, Send } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChannelChoice } from '@/features/notifications/alerts';

interface Choice {
  value: ChannelChoice;
  label: string;
  short: string;
  icon: typeof Bell;
}

const NONE: Choice = { value: 'none', label: 'Sin avisos', short: '', icon: BellOff };

const choices: Choice[] = [
  NONE,
  { value: 'windows', label: 'Windows', short: 'Windows', icon: Monitor },
  { value: 'telegram', label: 'Telegram', short: 'Telegram', icon: Send },
  { value: 'both', label: 'Windows y Telegram', short: 'Ambos', icon: BellRing },
];

interface MvpAlertMenuProps {
  mvpName: string;
  value: ChannelChoice;
  config: AlertConfigResponse | undefined;
  onChange: (value: ChannelChoice) => void;
}

/** Hint de un canal que todavía no puede entregar avisos. */
function pendingHint(value: ChannelChoice, config: AlertConfigResponse | undefined) {
  if (!config) return null;
  const needsWindows = value === 'windows' || value === 'both';
  const needsTelegram = value === 'telegram' || value === 'both';
  if (needsTelegram && !config.telegram.chatLinked) return 'Configura Telegram en «Avisos»';
  if (needsWindows && !config.windowsAvailable) return 'Solo en la app de escritorio';
  return null;
}

/** Por dónde avisar de este MVP: Windows, Telegram, ambos o ninguno. */
export function MvpAlertMenu({ mvpName, value, config, onChange }: MvpAlertMenuProps) {
  const current = choices.find((choice) => choice.value === value) ?? NONE;
  const active = value !== 'none';
  const Icon = active ? current.icon : Bell;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Avisos de ${mvpName}: ${current.label}`}
        className={cn(
          'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition',
          active
            ? 'bg-gold-400/10 text-gold-200 ring-1 ring-gold-400/30 ring-inset hover:bg-gold-400/15'
            : 'text-ink-faint hover:bg-white/5 hover:text-gold-300',
        )}
      >
        <Icon aria-hidden="true" className="size-4.5" />
        {active && <span className="hidden sm:inline">{current.short}</span>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="panel z-50 min-w-60 rounded-xl p-1.5 shadow-2xl data-[state=open]:animate-fade"
        >
          <Menu.Label className="px-2.5 pt-1.5 pb-2 text-xs font-medium text-ink-faint">
            Avisar de {mvpName} por…
          </Menu.Label>
          <Menu.RadioGroup value={value} onValueChange={(next) => onChange(next as ChannelChoice)}>
            {choices.map((choice) => {
              const hint = pendingHint(choice.value, config);
              return (
                <Menu.RadioItem
                  key={choice.value}
                  value={choice.value}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted outline-none data-[highlighted]:bg-white/6 data-[highlighted]:text-ink data-[state=checked]:text-gold-200"
                >
                  <choice.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span className="flex-1">
                    {choice.label}
                    {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
                  </span>
                  <Menu.ItemIndicator>
                    <Check aria-hidden="true" className="mt-0.5 size-4" />
                  </Menu.ItemIndicator>
                </Menu.RadioItem>
              );
            })}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
