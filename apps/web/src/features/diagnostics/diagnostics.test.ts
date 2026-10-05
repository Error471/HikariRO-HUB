import type { DiagnosticsResponse } from '@hikari-hub/shared';
import { describe, expect, it } from 'vitest';
import { changedModules, diagnosticsText } from './diagnostics';

const data: DiagnosticsResponse = {
  version: '1.2.3',
  platform: 'Windows_NT 10.0 (x64)',
  startedAt: '2026-10-05T08:00:00.000Z',
  modules: [
    { module: 'mvp', state: 'ok', checkedAt: '2026-10-05T09:00:00.000Z', since: null },
    { module: 'markets', state: 'changed', checkedAt: '2026-10-05T09:01:00.000Z', since: null },
    { module: 'wiki', state: 'unknown', checkedAt: null, since: null },
  ],
  entries: [{ time: '2026-10-05T09:01:00.000Z', level: 'warn', message: 'upstream error' }],
};

describe('diagnóstico', () => {
  it('lista los módulos que HikariRO ha cambiado', () => {
    expect(changedModules(data)).toEqual(['Mercados']);
    expect(changedModules(undefined)).toEqual([]);
  });

  it('genera un texto legible para reportar', () => {
    const text = diagnosticsText(data, 'Test');
    expect(text).toContain('Hikari Hub 1.2.3');
    expect(text).toContain('- Mercados: HikariRO ha cambiado');
    expect(text).toContain('- Wiki: Sin comprobar');
    expect(text).toContain('AVISO upstream error');
  });
});
