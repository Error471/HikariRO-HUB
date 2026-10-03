import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('los favoritos se guardan en la cuenta y sobreviven a otro navegador', async ({
  page,
  browser,
}) => {
  await login(page, '/mvp');
  const star = page.getByRole('button', { name: /Baphomet a favoritos/ });
  const remove = page.getByRole('button', { name: 'Quitar Baphomet de favoritos' });
  if (await remove.isVisible()) await remove.click();
  await star.click();
  await expect(remove).toHaveAttribute('aria-pressed', 'true');

  // Otro contexto = otro dispositivo sin el localStorage del primero.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, '/mvp?filter=favorites');
  await expect(otherPage.getByRole('heading', { name: 'Baphomet' })).toBeVisible();
  await other.close();

  await remove.click();
  await expect(star).toHaveAttribute('aria-pressed', 'false');
});

test('el diálogo de avisos informa del estado', async ({ page }) => {
  await login(page, '/mvp');
  await page.getByRole('button', { name: 'Avisos' }).click();
  const dialog = page.getByRole('dialog', { name: 'Avisos de MVP' });
  await expect(dialog).toBeVisible();
  // El servidor de e2e no tiene claves VAPID.
  await expect(
    dialog.getByText('Los avisos no están configurados en este servidor.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toBeHidden();
});
