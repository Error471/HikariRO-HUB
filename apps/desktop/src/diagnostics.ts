import { readFileSync } from 'node:fs';

export interface DiagnosticsInfo {
  version: string;
  platform: string;
  /** Texto que limpia tokens, contraseñas y rutas de usuario. */
  sanitize: (text: string) => string;
}

const MAX_ENTRIES = 40;
const LEVEL_NAMES: Record<number, string> = { 40: 'AVISO', 50: 'ERROR', 60: 'FATAL' };

interface LogLine {
  level?: number;
  time?: number;
  msg?: string;
  code?: string;
  module?: string;
  cause?: string;
  err?: { type?: string; message?: string };
}

function parseLine(line: string): LogLine | null {
  try {
    const value: unknown = JSON.parse(line);
    return value && typeof value === 'object' ? (value as LogLine) : null;
  } catch {
    return null;
  }
}

function describe(entry: LogLine): string {
  const time = entry.time ? new Date(entry.time).toISOString() : '?';
  const level = LEVEL_NAMES[entry.level ?? 0] ?? 'AVISO';
  const err = entry.err ? `${entry.err.type ?? 'Error'}: ${entry.err.message ?? ''}` : '';
  const details = [entry.msg, entry.code, entry.module, entry.cause, err].filter(Boolean);
  return `${time} ${level} ${details.join(' · ')}`;
}

/** Resumen para pegar en un reporte: versión, sistema y últimos avisos/errores del log. */
export function formatDiagnostics(logText: string, info: DiagnosticsInfo): string {
  const entries = logText
    .split('\n')
    .map(parseLine)
    .filter((entry): entry is LogLine => (entry?.level ?? 0) >= 40)
    .slice(-MAX_ENTRIES)
    .reverse()
    .map((entry) => info.sanitize(describe(entry)));

  return [
    `Hikari Hub ${info.version}`,
    `Sistema: ${info.platform}`,
    `Generado: ${new Date().toISOString()}`,
    '',
    entries.length ? 'Últimos avisos y errores:' : 'No hay avisos ni errores recientes.',
    ...entries,
  ].join('\n');
}

export function readLogText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}
