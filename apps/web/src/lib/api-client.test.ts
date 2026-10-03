import { sessionResponseSchema } from '@hrc/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, setCsrfToken } from './api-client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

describe('apiRequest', () => {
  it('valida la respuesta con el esquema', async () => {
    const session = {
      user: { username: 'ivan' },
      csrfToken: 't',
      expiresAt: '2026-10-05T00:00:00Z',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, session)));
    await expect(apiRequest('/auth/me', { schema: sessionResponseSchema })).resolves.toEqual(
      session,
    );
  });

  it('envía el token CSRF solo en métodos no seguros', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('csrf-123');

    await apiRequest('/auth/me');
    await apiRequest('/auth/logout', { method: 'POST' });

    expect(fetchMock.mock.calls[0]?.[1].headers['x-csrf-token']).toBeUndefined();
    expect(fetchMock.mock.calls[1]?.[1].headers['x-csrf-token']).toBe('csrf-123');
  });

  it('convierte el error de la API en ApiError con mensaje para el usuario', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          error: { code: 'SESSION_EXPIRED', message: 'Tu sesión ha expirado.' },
        }),
      ),
    );
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      message: 'Tu sesión ha expirado.',
      status: 401,
    });
  });

  it('nunca muestra respuestas inesperadas del servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Stack trace...</html>', { status: 500 })),
    );
    const error = await apiRequest('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).not.toContain('Stack');
  });

  it('informa de errores de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiRequest('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
