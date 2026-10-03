import { AppError } from '../lib/app-error.js';
import { CookieJar } from '../lib/cookie-jar.js';
import {
  fluxRoutes,
  isAuthenticatedPage,
  isLoginRedirect,
  parseLoginForm,
} from './fluxcp-pages.js';
import type { HikariClient } from './hikari-client.js';

/** Autenticación contra FluxCP. La contraseña solo vive durante la llamada a `login`. */
export class HikariAuth {
  constructor(private readonly client: HikariClient) {}

  async login(username: string, password: string): Promise<CookieJar> {
    const jar = new CookieJar();
    const loginPage = await this.client.get(fluxRoutes.login, jar);
    const form = parseLoginForm(loginPage.body);
    if (!form) throw new AppError('UPSTREAM_CHANGED');

    await this.client.postForm(form.action, { ...form.extraFields, username, password }, jar);

    if (!(await this.isAuthenticated(jar))) throw new AppError('INVALID_CREDENTIALS');
    return jar;
  }

  /** Comprueba en HikariRO que la sesión sigue activa (y la renueva). */
  async isAuthenticated(jar: CookieJar): Promise<boolean> {
    const response = await this.client.get(fluxRoutes.accountView, jar);
    if (isLoginRedirect(response)) return false;
    return isAuthenticatedPage(response);
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
