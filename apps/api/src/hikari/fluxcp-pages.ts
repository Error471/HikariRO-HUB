import * as cheerio from 'cheerio';
import type { HikariResponse } from './hikari-client.js';

/** Rutas de FluxCP verificadas en el análisis técnico (docs/01-analisis-tecnico-y-arquitectura.md). */
export const fluxRoutes = {
  login: '/?module=account&action=login',
  loginSubmit: '/?module=account&action=login&return_url=',
  accountView: '/?module=account&action=view',
  logout: '/?module=account&action=logout',
  mvpTimerData: '/?module=mvptimer&ajax=1',
} as const;

export interface LoginForm {
  action: string;
  /** Campos adicionales del formulario (p. ej. el hidden `server`). */
  extraFields: Record<string, string>;
}

/** Extrae el formulario de login (el que contiene el campo `password`). */
export function parseLoginForm(html: string): LoginForm | null {
  const $ = cheerio.load(html);
  const form = $('form')
    .filter((_, element) => $(element).find('input[name="password"]').length > 0)
    .first();
  if (form.length === 0) return null;

  const extraFields: Record<string, string> = {};
  form.find('input[name], button[name]').each((_, element) => {
    const field = $(element);
    const name = field.attr('name');
    if (!name || name === 'username' || name === 'password') return;
    const type = (field.attr('type') ?? '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return;
    extraFields[name] = field.attr('value') ?? '';
  });

  const action = form.attr('action') ?? fluxRoutes.loginSubmit;
  return { action: normalizeAction(action), extraFields };
}

/** FluxCP redirige al login (con `return_url`) cuando la sesión no es válida. */
export function isLoginRedirect(response: HikariResponse): boolean {
  if (response.status < 300 || response.status >= 400 || !response.location) return false;
  const url = new URL(response.location);
  return url.searchParams.get('module') === 'account' && url.searchParams.get('action') === 'login';
}

export function isAuthenticatedPage(response: HikariResponse): boolean {
  if (response.status !== 200) return false;
  const $ = cheerio.load(response.body);
  if ($('input[name="password"]').length > 0) return false;
  return $('a[href*="action=logout"]').length > 0;
}

/** Página con el formulario de login (FluxCP a veces lo muestra sin redirigir). */
export function isLoginPage(response: HikariResponse): boolean {
  if (response.status !== 200) return false;
  return cheerio.load(response.body)('input[name="password"]').length > 0;
}

function normalizeAction(action: string): string {
  if (action.startsWith('/')) return action;
  if (action.startsWith('?')) return `/${action}`;
  return fluxRoutes.loginSubmit;
}
