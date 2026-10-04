import { readFileSync, writeFileSync } from 'node:fs';

/** Preferencias de la app de escritorio (no de la cuenta). */
export interface DesktopPreferences {
  /** Ya se explicó que cerrar la ventana deja la app junto al reloj. */
  trayHintShown: boolean;
}

const defaults: DesktopPreferences = { trayHintShown: false };

export function readPreferences(path: string): DesktopPreferences {
  try {
    const stored = JSON.parse(readFileSync(path, 'utf8')) as Partial<DesktopPreferences>;
    return { trayHintShown: stored.trayHintShown === true };
  } catch {
    return { ...defaults };
  }
}

export function writePreferences(path: string, preferences: DesktopPreferences): void {
  try {
    writeFileSync(path, JSON.stringify(preferences));
  } catch {
    // No es crítico.
  }
}
