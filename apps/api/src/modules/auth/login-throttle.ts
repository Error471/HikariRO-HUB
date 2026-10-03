import type { Redis } from 'ioredis';

/** Cuenta intentos fallidos por usuario para no provocar bloqueos en HikariRO. */
export interface LoginThrottle {
  isBlocked(key: string): Promise<boolean>;
  registerFailure(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

interface ThrottleOptions {
  maxAttempts: number;
  windowMs: number;
}

export class MemoryLoginThrottle implements LoginThrottle {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly options: ThrottleOptions) {}

  async isBlocked(key: string): Promise<boolean> {
    const entry = this.current(key);
    return entry !== undefined && entry.count >= this.options.maxAttempts;
  }

  async registerFailure(key: string): Promise<void> {
    const entry = this.current(key) ?? { count: 0, resetAt: Date.now() + this.options.windowMs };
    entry.count += 1;
    this.attempts.set(key, entry);
  }

  async reset(key: string): Promise<void> {
    this.attempts.delete(key);
  }

  private current(key: string) {
    const entry = this.attempts.get(key);
    if (entry && entry.resetAt <= Date.now()) {
      this.attempts.delete(key);
      return undefined;
    }
    return entry;
  }
}

export class RedisLoginThrottle implements LoginThrottle {
  constructor(
    private readonly redis: Redis,
    private readonly options: ThrottleOptions,
    private readonly prefix = 'hrc:login-fail:',
  ) {}

  async isBlocked(key: string): Promise<boolean> {
    const count = Number((await this.redis.get(this.prefix + key)) ?? 0);
    return count >= this.options.maxAttempts;
  }

  async registerFailure(key: string): Promise<void> {
    const redisKey = this.prefix + key;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.pexpire(redisKey, this.options.windowMs);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }
}

export function throttleKey(username: string): string {
  return username.trim().toLowerCase();
}
