import { z } from 'zod';

/** Partes de HikariRO de las que depende la app. */
export const upstreamModules = [
  'login',
  'mvp',
  'markets',
  'news',
  'wiki',
  'cards',
  'fishing',
] as const;
export const upstreamModuleSchema = z.enum(upstreamModules);
export type UpstreamModule = z.infer<typeof upstreamModuleSchema>;

export const upstreamModuleLabels: Record<UpstreamModule, string> = {
  login: 'Inicio de sesión',
  mvp: 'MVP Timer',
  markets: 'Mercados',
  news: 'Noticias',
  wiki: 'Wiki',
  cards: 'Álbum de cartas',
  fishing: 'Álbum de pesca',
};

/**
 * `ok`: la última consulta funcionó. `changed`: HikariRO respondió con un formato que la app
 * no reconoce (ha cambiado su web). `unavailable`: no respondió. `unknown`: aún no se ha usado.
 */
export const moduleStateSchema = z.enum(['ok', 'changed', 'unavailable', 'unknown']);
export type ModuleState = z.infer<typeof moduleStateSchema>;

export const moduleHealthSchema = z.object({
  module: upstreamModuleSchema,
  state: moduleStateSchema,
  /** Última consulta a HikariRO de este módulo. */
  checkedAt: z.string().nullable(),
  /** Desde cuándo está en el estado actual. */
  since: z.string().nullable(),
});
export type ModuleHealth = z.infer<typeof moduleHealthSchema>;

export const journalEntrySchema = z.object({
  time: z.string(),
  level: z.enum(['warn', 'error']),
  message: z.string(),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

export const diagnosticsResponseSchema = z.object({
  version: z.string(),
  platform: z.string(),
  startedAt: z.string(),
  modules: z.array(moduleHealthSchema),
  /** Errores recientes, del más nuevo al más antiguo. Sin datos personales ni secretos. */
  entries: z.array(journalEntrySchema),
});
export type DiagnosticsResponse = z.infer<typeof diagnosticsResponseSchema>;
