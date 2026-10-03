interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Cache en memoria con caducidad y deduplicación de peticiones simultáneas. */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  async get(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = loader()
      .then((value) => {
        this.store(key, value);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  private store(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) this.evictOldest();
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private evictOldest(): void {
    const oldest = this.entries.keys().next();
    if (!oldest.done) this.entries.delete(oldest.value);
  }
}
