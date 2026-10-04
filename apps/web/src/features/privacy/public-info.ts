import { publicInfoSchema } from '@hikari-hub/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';

/** Información pública de la app (contacto de privacidad, opciones disponibles). */
export const publicInfoQuery = queryOptions({
  queryKey: ['public-info'],
  queryFn: ({ signal }) => apiRequest('/info', { schema: publicInfoSchema, signal }),
  staleTime: Infinity,
});
