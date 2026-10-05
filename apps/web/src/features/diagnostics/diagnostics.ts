import {
  diagnosticsResponseSchema,
  upstreamModuleLabels,
  type DiagnosticsResponse,
  type ModuleState,
} from '@hikari-hub/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

export const DIAGNOSTICS_REFRESH_MS = 60_000;

export const diagnosticsQuery = queryOptions({
  queryKey: ['diagnostics'],
  queryFn: ({ signal }) =>
    apiRequest('/diagnostics', { schema: diagnosticsResponseSchema, signal }),
  staleTime: 15_000,
});

export const moduleStateLabels: Record<ModuleState, string> = {
  ok: 'Funciona',
  changed: 'HikariRO ha cambiado',
  unavailable: 'Sin respuesta',
  unknown: 'Sin comprobar',
};

/** Módulos que HikariRO ha cambiado y la app no puede leer. */
export function changedModules(data: DiagnosticsResponse | undefined): string[] {
  return (data?.modules ?? [])
    .filter((module) => module.state === 'changed')
    .map((module) => upstreamModuleLabels[module.module]);
}

/** Texto para pegar en un reporte. No contiene datos personales. */
export function diagnosticsText(
  data: DiagnosticsResponse,
  userAgent = navigator.userAgent,
): string {
  const modules = data.modules.map(
    (module) =>
      `- ${upstreamModuleLabels[module.module]}: ${moduleStateLabels[module.state]}${
        module.checkedAt ? ` (comprobado ${module.checkedAt})` : ''
      }`,
  );
  const entries = data.entries.map(
    (entry) => `${entry.time} ${entry.level === 'error' ? 'ERROR' : 'AVISO'} ${entry.message}`,
  );
  return [
    `Hikari Hub ${data.version}`,
    `Sistema: ${data.platform}`,
    `Navegador: ${userAgent}`,
    `En marcha desde: ${data.startedAt}`,
    '',
    'Estado de HikariRO:',
    ...modules,
    '',
    entries.length ? 'Últimos avisos y errores:' : 'No hay avisos ni errores recientes.',
    ...entries,
  ].join('\n');
}

export function useClearJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('/diagnostics/entries', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosticsQuery.queryKey }),
  });
}
