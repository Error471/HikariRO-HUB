import type { Redis } from 'ioredis';
import { z } from 'zod';

export const sessionRecordSchema = z.object({
  username: z.string(),
  /** Cookies de HikariRO cifradas con AES-256-GCM. */
  upstream: z.string(),
  csrfToken: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
  validatedAt: z.number(),
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export interface SessionStore {
  get(id: string): Promise<SessionRecord | null>;
  set(id: string, record: SessionRecord): Promise<void>;
  delete(id: string): Promise<void>;
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
}

export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'hrc:session:',
  ) {}

  async get(id: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(this.prefix + id);
    if (!raw) return null;
    const parsed = sessionRecordSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  }

  async set(id: string, record: SessionRecord): Promise<void> {
    const ttlMs = Math.max(1, record.expiresAt - Date.now());
    await this.redis.set(this.prefix + id, JSON.stringify(record), 'PX', ttlMs);
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(this.prefix + id);
  }
}
