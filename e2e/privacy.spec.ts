import { expect, test } from '@playwright/test';
import { isMobile, login } from './helpers';

test('la página de privacidad es pública y se enlaza desde el login', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Privacidad y cómo funciona' }).click();
  await expect(page).toHaveURL(/\/privacidad/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Privacidad y cómo funciona' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cómo borrar tus datos' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al inicio de sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('borrar mis datos elimina los favoritos y cierra la sesión', async ({ page }) => {
  await login(page, '/mvp');
  const remove = page.getByRole('button', { name: 'Quitar Drake de favoritos' });
  if (!(await remove.isVisible()))
    await page.getByRole('button', { name: 'Añadir Drake a favoritos' }).click();
  await expect(remove).toBeVisible();

  if (isMobile(page)) await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('button', { name: 'Borrar mis datos' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Borrar tus datos?' });
  await dialog.getByRole('button', { name: 'Borrar mis datos' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Tus datos se han borrado')).toBeVisible();

  await login(page, '/mvp?filter=favorites');
  await expect(page.getByText('Marca MVPs con la estrella para verlos aquí.')).toBeVisible();
});
