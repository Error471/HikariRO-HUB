import { AppError } from '../lib/app-error.js';
import { CookieJar } from '../lib/cookie-jar.js';
import {
  fluxRoutes,
  isAuthenticatedPage,
  isLoginPage,
  isLoginRedirect,
  parseLoginForm,
} from './fluxcp-pages.js';
import type { HikariClient } from './hikari-client.js';
import { untracked, type UpstreamTracker } from './upstream-monitor.js';

/**
 * Estado de la sesión en HikariRO. `unknown` = respuesta inesperada (mantenimiento, error
 * temporal…): no se debe tratar como sesión caducada.
 */
export type AuthState = 'authenticated' | 'anonymous' | 'unknown';

/** Autenticación contra FluxCP. La contraseña solo vive durante la llamada a `login`. */
export class HikariAuth {
  constructor(
    private readonly client: HikariClient,
    private readonly monitor: UpstreamTracker = untracked,
  ) {}

  login(username: string, password: string): Promise<CookieJar> {
    return this.monitor.track('login', () => this.submitLogin(username, password));
  }

  private async submitLogin(username: string, password: string): Promise<CookieJar> {
    const jar = new CookieJar();
    const loginPage = await this.client.get(fluxRoutes.login, jar);
    const form = parseLoginForm(loginPage.body);
    if (!form) throw new AppError('UPSTREAM_CHANGED');

    await this.client.postForm(form.action, { ...form.extraFields, username, password }, jar);

    const state = await this.check(jar);
    if (state === 'anonymous') throw new AppError('INVALID_CREDENTIALS');
    if (state === 'unknown') throw new AppError('UPSTREAM_UNAVAILABLE');
    return jar;
  }

  /** Comprueba en HikariRO si la sesión sigue activa (y de paso la mantiene viva). */
  async check(jar: CookieJar): Promise<AuthState> {
    const response = await this.client.get(fluxRoutes.accountView, jar);
    if (isLoginRedirect(response) || isLoginPage(response)) return 'anonymous';
    return isAuthenticatedPage(response) ? 'authenticated' : 'unknown';
  }

  /** Cierre de sesión en HikariRO; un fallo aquí no debe impedir el logout local. */
  async logout(jar: CookieJar): Promise<void> {
    try {
      await this.client.get(fluxRoutes.logout, jar);
    } catch {
      // La sesión local se destruye igualmente.
    }
  }
}
