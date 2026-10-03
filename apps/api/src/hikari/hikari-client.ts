import { request, type Dispatcher } from 'undici';
import { AppError } from '../lib/app-error.js';
import type { CookieJar } from '../lib/cookie-jar.js';

export interface HikariClientOptions {
  baseUrl: string;
  userAgent: string;
  timeoutMs: number;
  dispatcher?: Dispatcher;
}

export interface HikariResponse {
  status: number;
  /** Destino absoluto de una redirección (3xx), si existe. */
  location: string | undefined;
  contentType: string;
  body: string;
}

const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Cliente HTTP de bajo nivel para HikariRO. Solo acepta rutas relativas al host
 * configurado (no hay URLs controladas por el usuario → sin riesgo de SSRF).
 * Nunca sigue redirecciones: las redirecciones al login son la señal de sesión caducada.
 */
export class HikariClient {
  private readonly origin: string;

  constructor(private readonly options: HikariClientOptions) {
    this.origin = new URL(options.baseUrl).origin;
  }

  get(path: string, jar?: CookieJar): Promise<HikariResponse> {
    return this.send('GET', path, undefined, jar);
  }

  postForm(path: string, form: Record<string, string>, jar?: CookieJar): Promise<HikariResponse> {
    return this.send('POST', path, new URLSearchParams(form).toString(), jar);
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
