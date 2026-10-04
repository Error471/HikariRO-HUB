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

export function throttleKey(username: string): string {
  return username.trim().toLowerCase();
}
