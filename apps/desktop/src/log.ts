import { appendFileSync, mkdirSync, statSync, truncateSync } from 'node:fs';
import { dirname } from 'node:path';

const MAX_LOG_BYTES = 5 * 1024 * 1024;

/** Empieza de cero si el log ha crecido demasiado: solo sirve para diagnosticar errores recientes. */
export function prepareLogFile(path: string, maxBytes = MAX_LOG_BYTES): void {
  mkdirSync(dirname(path), { recursive: true });
  try {
    if (statSync(path).size > maxBytes) truncateSync(path, 0);
  } catch {
    // No existe todavía.
  }
}

/** Registro del proceso principal en el mismo archivo que la API (formato JSON por línea). */
export function createMainLogger(path: string) {
  const write = (level: number, msg: string, error?: unknown) => {
    const err = error instanceof Error ? { type: error.name, message: error.message } : undefined;
    try {
      appendFileSync(
        path,
        `${JSON.stringify({ level, time: Date.now(), name: 'desktop', msg, ...(err && { err }) })}\n`,
      );
    } catch {
      // Sin log no se detiene la app.
    }
  };
  return {
    info: (msg: string) => write(30, msg),
    warn: (msg: string, error?: unknown) => write(40, msg, error),
    error: (msg: string, error?: unknown) => write(50, msg, error),
  };
}

export type MainLogger = ReturnType<typeof createMainLogger>;
