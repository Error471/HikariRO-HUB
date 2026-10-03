import { expect, type Page } from '@playwright/test';

/** Inicia sesión con el usuario del mock de HikariRO. */
export async function login(page: Page, path = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(path)}`);
  await page.getByLabel('Usuario').fill('demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Falla el test si la página lanza errores de JavaScript. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;
