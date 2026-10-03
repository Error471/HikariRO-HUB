import { describe, expect, it } from 'vitest';
import {
  isAuthenticatedPage,
  isLoginRedirect,
  parseLoginForm,
} from '../src/hikari/fluxcp-pages.js';
import { fixture } from './helpers.js';

const response = (status: number, body = '', location?: string) => ({
  status,
  body,
  location,
  contentType: 'text/html',
});

describe('parseLoginForm', () => {
  it('extrae la acción y los campos ocultos del formulario de login', () => {
    expect(parseLoginForm(fixture('login-page.html'))).toEqual({
      action: '/?module=account&action=login&return_url=',
      extraFields: { server: 'TestSrv1', submit: '' },
    });
  });

  it('devuelve null si la página ya no tiene formulario de login', () => {
    expect(parseLoginForm('<html><body>Mantenimiento</body></html>')).toBeNull();
  });
});

describe('detección de sesión', () => {
  it('reconoce la redirección al login como sesión no válida', () => {
    const redirect = response(
      302,
      '',
      'https://hikariro.test/?module=account&action=login&return_url=%2F%3Fmodule%3Dcartaslog',
    );
    expect(isLoginRedirect(redirect)).toBe(true);
    expect(isLoginRedirect(response(302, '', 'https://hikariro.test/?module=main'))).toBe(false);
  });

  it('reconoce una página autenticada por el enlace de logout', () => {
    expect(isAuthenticatedPage(response(200, fixture('account-view.html')))).toBe(true);
    expect(isAuthenticatedPage(response(200, fixture('login-page.html')))).toBe(false);
  });
});
