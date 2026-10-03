import { expect, test } from '@playwright/test';
import { collectPageErrors, isMobile, login } from './helpers';

test('redirige al login y rechaza credenciales incorrectas', async ({ page }) => {
  await page.goto('/mvp');
  await expect(page).toHaveURL(/\/login\?redirect=/);

  await page.getByLabel('Usuario').fill('demo');
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText(/usuario o contraseña/i);
});

test('inicia sesión, vuelve a la ruta pedida y cierra sesión', async ({ page }) => {
  const errors = collectPageErrors(page);
  await login(page, '/mvp');
  await expect(page).toHaveURL(/\/mvp/);
  await expect(page.getByRole('heading', { name: 'MVP Timer', level: 1 })).toBeVisible();

  if (isMobile(page)) await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  expect(errors).toEqual([]);
});
