import { z } from 'zod';
import { JsonFile } from '../lib/json-file.js';

export const sessionRecordSchema = z.object({
  username: z.string(),
  /** Cookies de HikariRO cifradas con AES-256-GCM. */
  upstream: z.string(),
  csrfToken: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
  validatedAt: z.number(),
  /** Contraseña cifrada, solo si el usuario pidió mantener la sesión iniciada. */
  credentials: z.string().optional(),
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export interface SessionStore {
  get(id: string): Promise<SessionRecord | null>;
  set(id: string, record: SessionRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** Identificadores de las sesiones vigentes. */
  list(): Promise<string[]>;
}

/** Solo para desarrollo y tests: se pierde al reiniciar y no se comparte entre procesos. */
export class MemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();

  async get(id: string): Promise<SessionRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this.records.delete(id);
      return null;
    }
    return record;
  }

  async set(id: string, record: SessionRecord): Promise<void> {
    this.records.set(id, record);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async list(): Promise<string[]> {
    const now = Date.now();
    return [...this.records].filter(([, record]) => record.expiresAt > now).map(([id]) => id);
  }
}

/** Sesiones guardadas en un archivo para no tener que volver a entrar al reiniciar la app. */
export class FileSessionStore implements SessionStore {
  private readonly file: JsonFile<Record<string, SessionRecord>>;
  private readonly records: Map<string, SessionRecord>;

  constructor(path: string) {
    this.file = new JsonFile(path, z.record(z.string(), sessionRecordSchema), () => ({}));
    const now = Date.now();
    this.records = new Map(
      Object.entries(this.file.load()).filter(([, record]) => record.expiresAt > now),
    );
  }

  async get(id: string): Promise<SessionRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      await this.delete(id);
      return null;
    }
    return record;
  }

  async set(id: string, record: SessionRecord): Promise<void> {
    this.records.set(id, record);
    await this.persist();
  }

  async delete(id: string): Promise<void> {
    if (this.records.delete(id)) await this.persist();
  }

  async list(): Promise<string[]> {
    const now = Date.now();
    return [...this.records].filter(([, record]) => record.expiresAt > now).map(([id]) => id);
  }

  private persist(): Promise<void> {
    return this.file.save(Object.fromEntries(this.records));
  }
}
