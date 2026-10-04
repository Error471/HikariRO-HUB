import { leadMinutesSchema, type LeadMinutes } from '@hikari-hub/shared';
import { z } from 'zod';
import { JsonFile } from '../lib/json-file.js';

export interface AlertState {
  enabled: boolean;
  leadMinutes: LeadMinutes;
  /** Sesión de Hikari Hub que usa el vigilante de MVPs para consultar HikariRO. */
  watchSessionId: string | null;
}

export const defaultAlertState = (): AlertState => ({
  enabled: false,
  leadMinutes: 5,
  watchSessionId: null,
});

const alertStateSchema = z.object({
  enabled: z.boolean(),
  leadMinutes: leadMinutesSchema,
  watchSessionId: z.string().nullable(),
});

/**
 * Datos propios de Hikari Hub por cuenta de HikariRO (favoritos y avisos).
 * Es lo único que se persiste: no hace falta una base de datos.
 */
export interface UserDataStore {
  getFavorites(username: string): Promise<number[]>;
  setFavorites(username: string, ids: number[]): Promise<void>;
  getAlerts(username: string): Promise<AlertState>;
  setAlerts(username: string, state: AlertState): Promise<void>;
  /** Usuarios con los avisos activados. */
  alertUsers(): Promise<string[]>;
  /** Marca un aviso como enviado; devuelve `false` si ya lo estaba (evita duplicados). */
  claimNotification(key: string, ttlSeconds: number): Promise<boolean>;
  /** Borra favoritos y avisos de la cuenta. */
  deleteUser(username: string): Promise<void>;
}

export const userKey = (username: string) => username.trim().toLowerCase();

const userDataSchema = z.object({
  favorites: z.record(z.string(), z.array(z.number().int())),
  alerts: z.record(z.string(), alertStateSchema),
  claims: z.record(z.string(), z.number()),
});
type UserData = z.infer<typeof userDataSchema>;

const emptyData = (): UserData => ({ favorites: {}, alerts: {}, claims: {} });

const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

/** Implementación en memoria; `onChange` permite volcarla a disco. */
export class MemoryUserDataStore implements UserDataStore {
  protected readonly data: UserData;

  constructor(initial: UserData = emptyData()) {
    this.data = initial;
  }

  async getFavorites(username: string): Promise<number[]> {
    return [...(this.data.favorites[userKey(username)] ?? [])];
  }

  async setFavorites(username: string, ids: number[]): Promise<void> {
    this.data.favorites[userKey(username)] = [...ids];
    await this.onChange();
  }

  async getAlerts(username: string): Promise<AlertState> {
    const state = this.data.alerts[userKey(username)];
    return state ? structuredClone(state) : defaultAlertState();
  }

  async setAlerts(username: string, state: AlertState): Promise<void> {
    this.data.alerts[userKey(username)] = structuredClone(state);
    await this.onChange();
  }

  async alertUsers(): Promise<string[]> {
    return Object.entries(this.data.alerts)
      .filter(([, state]) => state.enabled)
      .map(([username]) => username);
  }

  async claimNotification(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    this.data.claims = Object.fromEntries(
      Object.entries(this.data.claims).filter(([, expiresAt]) => expiresAt > now),
    );
    if (this.data.claims[key] !== undefined) return false;
    this.data.claims[key] = now + ttlSeconds * 1000;
    await this.onChange();
    return true;
  }

  async deleteUser(username: string): Promise<void> {
    const key = userKey(username);
    this.data.favorites = without(this.data.favorites, key);
    this.data.alerts = without(this.data.alerts, key);
    await this.onChange();
  }

  protected async onChange(): Promise<void> {}
}

/** Guarda los datos en un archivo JSON del perfil del usuario de Windows. */
export class FileUserDataStore extends MemoryUserDataStore {
  private readonly file: JsonFile<UserData>;

  constructor(path: string) {
    const file = new JsonFile(path, userDataSchema, emptyData);
    super(file.load());
    this.file = file;
  }

  protected override onChange(): Promise<void> {
    return this.file.save(this.data);
  }
}
