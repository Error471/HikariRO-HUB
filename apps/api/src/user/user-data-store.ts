import {
  leadMinutesSchema,
  pushSubscriptionSchema,
  type LeadMinutes,
  type PushSubscriptionJson,
} from '@hrc/shared';
import type { Redis } from 'ioredis';
import { z } from 'zod';

export interface StoredSubscription {
  subscription: PushSubscriptionJson;
  createdAt: number;
}

export interface PushState {
  subscriptions: StoredSubscription[];
  leadMinutes: LeadMinutes;
  /** Sesión del Companion que usa el vigilante de MVPs para consultar HikariRO. */
  watchSessionId: string | null;
}

export const defaultPushState = (): PushState => ({
  subscriptions: [],
  leadMinutes: 5,
  watchSessionId: null,
});

const pushStateSchema = z.object({
  subscriptions: z.array(
    z.object({
      subscription: pushSubscriptionSchema,
      createdAt: z.number(),
    }),
  ),
  leadMinutes: leadMinutesSchema,
  watchSessionId: z.string().nullable(),
});

const favoritesSchema = z.array(z.number().int());

/**
 * Datos propios del Companion por cuenta de HikariRO (favoritos y avisos).
 * Es lo único que se persiste: no hace falta una base de datos relacional.
 */
export interface UserDataStore {
  getFavorites(username: string): Promise<number[]>;
  setFavorites(username: string, ids: number[]): Promise<void>;
  getPush(username: string): Promise<PushState>;
  setPush(username: string, state: PushState): Promise<void>;
  /** Usuarios con al menos un dispositivo suscrito. */
  pushUsers(): Promise<string[]>;
  /** Marca un aviso como enviado; devuelve `false` si ya lo estaba (evita duplicados). */
  claimNotification(key: string, ttlSeconds: number): Promise<boolean>;
  /** Borra favoritos y avisos de la cuenta. */
  deleteUser(username: string): Promise<void>;
}

export const userKey = (username: string) => username.trim().toLowerCase();

export class MemoryUserDataStore implements UserDataStore {
  private readonly favorites = new Map<string, number[]>();
  private readonly push = new Map<string, PushState>();
  private readonly claims = new Map<string, number>();

  async getFavorites(username: string): Promise<number[]> {
    return [...(this.favorites.get(userKey(username)) ?? [])];
  }

  async setFavorites(username: string, ids: number[]): Promise<void> {
    this.favorites.set(userKey(username), [...ids]);
  }

  async getPush(username: string): Promise<PushState> {
    const state = this.push.get(userKey(username));
    return state ? structuredClone(state) : defaultPushState();
  }

  async setPush(username: string, state: PushState): Promise<void> {
    this.push.set(userKey(username), structuredClone(state));
  }

  async pushUsers(): Promise<string[]> {
    return [...this.push.entries()]
      .filter(([, state]) => state.subscriptions.length > 0)
      .map(([username]) => username);
  }

  async claimNotification(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = this.claims.get(key);
    if (expiresAt !== undefined && expiresAt > now) return false;
    this.claims.set(key, now + ttlSeconds * 1000);
    return true;
  }

  async deleteUser(username: string): Promise<void> {
    this.favorites.delete(userKey(username));
    this.push.delete(userKey(username));
  }
}

export class RedisUserDataStore implements UserDataStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'hrc:',
  ) {}

  private key(username: string, field: string) {
    return `${this.prefix}user:${userKey(username)}:${field}`;
  }

  async getFavorites(username: string): Promise<number[]> {
    const raw = await this.redis.get(this.key(username, 'favorites'));
    const parsed = favoritesSchema.safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  }

  async setFavorites(username: string, ids: number[]): Promise<void> {
    await this.redis.set(this.key(username, 'favorites'), JSON.stringify(ids));
  }

  async getPush(username: string): Promise<PushState> {
    const raw = await this.redis.get(this.key(username, 'push'));
    if (!raw) return defaultPushState();
    const parsed = pushStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultPushState();
  }

  async setPush(username: string, state: PushState): Promise<void> {
    const users = `${this.prefix}push:users`;
    const multi = this.redis.multi().set(this.key(username, 'push'), JSON.stringify(state));
    if (state.subscriptions.length) multi.sadd(users, userKey(username));
    else multi.srem(users, userKey(username));
    await multi.exec();
  }

  pushUsers(): Promise<string[]> {
    return this.redis.smembers(`${this.prefix}push:users`);
  }

  async claimNotification(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(
      `${this.prefix}push:sent:${key}`,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async deleteUser(username: string): Promise<void> {
    await this.redis
      .multi()
      .del(this.key(username, 'favorites'), this.key(username, 'push'))
      .srem(`${this.prefix}push:users`, userKey(username))
      .exec();
  }
}
