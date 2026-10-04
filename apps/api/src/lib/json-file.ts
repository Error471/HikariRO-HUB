import { mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { z } from 'zod';

/**
 * Documento JSON en disco: se lee una vez al arrancar y cada guardado reescribe el archivo
 * entero de forma atómica (archivo temporal + rename). Pensado para pocos datos.
 */
export class JsonFile<T> {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly schema: z.ZodType<T>,
    private readonly fallback: () => T,
  ) {
    mkdirSync(dirname(path), { recursive: true });
  }

  /** Datos guardados o el valor por defecto si el archivo no existe o está dañado. */
  load(): T {
    try {
      const parsed = this.schema.safeParse(JSON.parse(readFileSync(this.path, 'utf8')));
      return parsed.success ? parsed.data : this.fallback();
    } catch {
      return this.fallback();
    }
  }

  /** Guarda en orden: dos llamadas seguidas nunca se pisan. */
  save(data: T): Promise<void> {
    const content = JSON.stringify(data);
    const write = async () => {
      const temp = `${this.path}.tmp`;
      await writeFile(temp, content, { mode: 0o600 });
      await rename(temp, this.path);
    };
    this.queue = this.queue.then(write, write);
    return this.queue;
  }
}
