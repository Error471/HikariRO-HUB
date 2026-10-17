import { request, type Dispatcher } from 'undici';
import { AppError } from '../lib/app-error.js';
import type { CookieJar } from '../lib/cookie-jar.js';

export interface HikariClientOptions {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  dispatcher?: Dispatcher;
  /** Espera base entre reintentos cuando FluxCP responde con su página de error. */
  retryDelayMs?: number;
  /** Pausa tras un error de servidor: empieza en `baseMs` y se duplica hasta `maxMs`. */
  pause?: { baseMs: number; maxMs: number };
  now?: () => number;
}

export interface HikariResponse {
  status: number;
  /** Destino absoluto de una redirección (3xx), si existe. */
  location: string | undefined;
  contentType: string;
  body: string;
}

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const SERVER_ERROR_RETRIES = 2;
const DEFAULT_PAUSE = { baseMs: 30_000, maxMs: 5 * 60_000 };
const SERVER_ERROR_MESSAGE =
  'HikariRO tiene problemas en su servidor ahora mismo. Inténtalo de nuevo en unos minutos.';

/**
 * FluxCP responde 200 con su página "Critical Error" cuando falla su base de datos
 * (p. ej. "Too many connections"). Es un fallo pasajero, no un cambio de la web.
 */
export function isFluxCriticalError(response: Pick<HikariResponse, 'status' | 'body'>): boolean {
  return response.status === 200 && /<title>[^<]*Critical Error[^<]*<\/title>/i.test(response.body);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cliente HTTP de bajo nivel para HikariRO. Solo acepta rutas relativas al host
 * configurado (no hay URLs controladas por el usuario → sin riesgo de SSRF).
 * Nunca sigue redirecciones: las redirecciones al login son la señal de sesión caducada.
 */
export class HikariClient {
  private readonly origin: string;
  private pausedUntil = 0;
  private serverErrors = 0;

  constructor(private readonly options: HikariClientOptions) {
    this.origin = new URL(options.baseUrl).origin;
  }

  /** Las lecturas se reintentan si FluxCP devuelve su página de error de servidor. */
  async get(path: string, jar?: CookieJar): Promise<HikariResponse> {
    this.assertNotPaused();
    const delayMs = this.options.retryDelayMs ?? 500;
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.send('GET', path, undefined, jar);
      if (!isFluxCriticalError(response)) return this.recovered(response);
      if (attempt >= SERVER_ERROR_RETRIES) throw this.pauseAfterServerError();
      await wait(delayMs * (attempt + 1));
    }
  }

  async postForm(
    path: string,
    form: Record<string, string>,
    jar?: CookieJar,
  ): Promise<HikariResponse> {
    this.assertNotPaused();
    const response = await this.send('POST', path, new URLSearchParams(form).toString(), jar);
    if (isFluxCriticalError(response)) throw this.pauseAfterServerError();
    return this.recovered(response);
  }

  // Pausa ante errores de servidor: mientras dura no se consulta a HikariRO para no
  // sumarle carga (avisos de MVP, mantener sesión, pantallas abiertas…).
  private assertNotPaused(): void {
    if (this.clock() < this.pausedUntil) {
      throw new AppError('UPSTREAM_UNAVAILABLE', { publicMessage: SERVER_ERROR_MESSAGE });
    }
  }

  private pauseAfterServerError(): AppError {
    const { baseMs, maxMs } = this.options.pause ?? DEFAULT_PAUSE;
    this.pausedUntil = this.clock() + Math.min(baseMs * 2 ** this.serverErrors, maxMs);
    this.serverErrors += 1;
    return new AppError('UPSTREAM_UNAVAILABLE', { publicMessage: SERVER_ERROR_MESSAGE });
  }

  private recovered(response: HikariResponse): HikariResponse {
    this.serverErrors = 0;
    return response;
  }

  private clock(): number {
    return this.options.now?.() ?? Date.now();
  }

  private async send(
    method: 'GET' | 'POST',
    path: string,
    body: string | undefined,
    jar: CookieJar | undefined,
  ): Promise<HikariResponse> {
    const url = this.resolve(path);
    const headers: Record<string, string> = {
      'user-agent': this.options.userAgent,
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'accept-language': 'es-ES,es;q=0.9',
    };
    const cookie = jar?.toHeader();
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      headers.origin = this.origin;
      headers.referer = url.href;
    }

    let response: Dispatcher.ResponseData;
    try {
      response = await request(url, {
        method,
        headers,
        body,
        dispatcher: this.options.dispatcher,
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new AppError('UPSTREAM_UNAVAILABLE', { cause: error });
    }

    jar?.absorb(response.headers['set-cookie']);
    const text = await readBody(response);
    const result: HikariResponse = {
      status: response.statusCode,
      location: this.resolveLocation(response.headers.location),
      contentType: headerValue(response.headers['content-type']),
      body: text,
    };

    if (isCloudflareChallenge(result, response.headers)) throw new AppError('UPSTREAM_BLOCKED');
    if (result.status >= 500) throw new AppError('UPSTREAM_UNAVAILABLE');
    return result;
  }

  private resolve(path: string): URL {
    if (!path.startsWith('/')) throw new Error(`Ruta de HikariRO no válida: ${path}`);
    const url = new URL(path, this.origin);
    if (url.origin !== this.origin) throw new Error('Origen de HikariRO no permitido');
    return url;
  }

  private resolveLocation(raw: string | string[] | undefined): string | undefined {
    const value = headerValue(raw);
    if (!value) return undefined;
    try {
      return new URL(value, this.origin).href;
    } catch {
      return undefined;
    }
  }
}

async function readBody(response: Dispatcher.ResponseData): Promise<string> {
  const declared = Number(headerValue(response.headers['content-length']) || 0);
  if (declared > MAX_BODY_BYTES) {
    await response.body.dump();
    throw new AppError('UPSTREAM_UNAVAILABLE');
  }
  try {
    return await response.body.text();
  } catch (error) {
    throw new AppError('UPSTREAM_UNAVAILABLE', { cause: error });
  }
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function isCloudflareChallenge(
  response: HikariResponse,
  headers: Dispatcher.ResponseData['headers'],
): boolean {
  if (headerValue(headers['cf-mitigated']).toLowerCase() === 'challenge') return true;
  if (![403, 429, 503].includes(response.status)) return false;
  return /challenge-platform|cf-chl|Just a moment\.\.\./i.test(response.body);
}
