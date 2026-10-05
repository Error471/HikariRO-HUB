import type { JournalEntry } from '@hikari-hub/shared';

const MAX_ENTRIES = 100;
const MAX_MESSAGE_LENGTH = 300;

/** Quita tokens, contraseñas, cookies y rutas de usuario antes de guardar un mensaje. */
export function sanitizeLogText(text: string): string {
  return text
    .replace(/bot\d{5,15}:[A-Za-z0-9_-]{20,}/g, 'bot[token]')
    .replace(/\b\d{5,15}:[A-Za-z0-9_-]{30,}\b/g, '[token]')
    .replace(
      /(password|passwd|pass|token|secret|cookie|session)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      '$1$2[redacted]',
    )
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '%USERPROFILE%')
    .replace(/\/(home|Users)\/[^/\s]+/g, '~')
    .slice(0, MAX_MESSAGE_LENGTH);
}

/** Últimos avisos y errores de la API, en memoria, para la página de diagnóstico. */
export class ErrorJournal {
  private entries: JournalEntry[] = [];

  constructor(
    private readonly max = MAX_ENTRIES,
    private readonly now: () => Date = () => new Date(),
  ) {}

  add(level: JournalEntry['level'], message: string): void {
    const entry = { time: this.now().toISOString(), level, message: sanitizeLogText(message) };
    this.entries = [entry, ...this.entries].slice(0, this.max);
  }

  list(): JournalEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

const PINO_WARN = 40;

/** Texto legible de una llamada al logger de pino: mensaje + código + causa. */
export function describeLogCall(args: unknown[]): string {
  const [first, second] = args;
  const message = typeof first === 'string' ? first : typeof second === 'string' ? second : '';
  const details: string[] = [];
  if (first && typeof first === 'object') {
    const data = first as Record<string, unknown>;
    if (typeof data.code === 'string') details.push(data.code);
    if (typeof data.module === 'string') details.push(data.module);
    if (typeof data.cause === 'string') details.push(data.cause);
    const err = data.err;
    if (err instanceof Error) details.push(`${err.name}: ${err.message}`);
  }
  return [message, ...details].filter(Boolean).join(' · ');
}

/** Hook de pino que copia avisos y errores al diario. */
export function journalHook(journal: ErrorJournal) {
  return {
    logMethod(
      this: unknown,
      args: Parameters<(...input: unknown[]) => void>,
      method: (...input: unknown[]) => void,
      level: number,
    ) {
      if (level >= PINO_WARN)
        journal.add(level > PINO_WARN ? 'error' : 'warn', describeLogCall(args));
      method.apply(this, args);
    },
  };
}
