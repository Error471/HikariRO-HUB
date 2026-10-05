import {
  upstreamModules,
  type ModuleHealth,
  type ModuleState,
  type UpstreamModule,
} from '@hikari-hub/shared';
import { AppError } from '../lib/app-error.js';

export type ModuleChangeListener = (module: UpstreamModule, state: ModuleState) => void;

function stateOf(error: unknown): ModuleState | null {
  if (!(error instanceof AppError)) return null;
  if (error.code === 'UPSTREAM_CHANGED') return 'changed';
  if (error.code === 'UPSTREAM_UNAVAILABLE' || error.code === 'UPSTREAM_BLOCKED') {
    return 'unavailable';
  }
  return null;
}

/**
 * Estado de cada parte de HikariRO según las últimas consultas. Sirve para avisar de que
 * HikariRO ha cambiado su web en lugar de mostrar secciones vacías.
 */
export class UpstreamMonitor {
  private readonly health = new Map<UpstreamModule, ModuleHealth>();
  private readonly listeners = new Set<ModuleChangeListener>();

  constructor(private readonly now: () => Date = () => new Date()) {
    for (const module of upstreamModules) {
      this.health.set(module, { module, state: 'unknown', checkedAt: null, since: null });
    }
  }

  /** Ejecuta una consulta a HikariRO y registra si funcionó o por qué falló. */
  async track<T>(module: UpstreamModule, task: () => Promise<T>): Promise<T> {
    try {
      const result = await task();
      this.record(module, 'ok');
      return result;
    } catch (error) {
      const state = stateOf(error);
      if (state) this.record(module, state);
      throw error;
    }
  }

  record(module: UpstreamModule, state: ModuleState): void {
    const at = this.now().toISOString();
    const previous = this.health.get(module);
    const changed = previous?.state !== state;
    this.health.set(module, {
      module,
      state,
      checkedAt: at,
      since: changed ? at : (previous?.since ?? at),
    });
    if (changed) for (const listener of this.listeners) listener(module, state);
  }

  onChange(listener: ModuleChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): ModuleHealth[] {
    return upstreamModules.map(
      (module) =>
        this.health.get(module) ?? { module, state: 'unknown', checkedAt: null, since: null },
    );
  }
}

/** Para servicios usados sin monitor (pruebas). */
export const untracked = {
  track: <T>(_module: UpstreamModule, task: () => Promise<T>) => task(),
};
export type UpstreamTracker = Pick<UpstreamMonitor, 'track'>;
