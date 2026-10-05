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

test('configura Telegram y elige el canal de aviso de cada MVP', async ({ page }) => {
  await login(page, '/mvp');
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Avisos de MVP' });
  // Fuera de la app de escritorio no hay notificaciones de Windows.
  await expect(
    dialog.getByText('Las notificaciones de Windows solo funcionan en la app de escritorio.'),
  ).toBeVisible();

  const removeBot = dialog.getByRole('button', { name: 'Quitar el bot' });
  if (await removeBot.isVisible()) await removeBot.click();
  await dialog.getByLabel('Token del bot').fill('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw');
  await dialog.getByRole('button', { name: 'Conectar bot' }).click();
  await expect(dialog.getByText('@hikari_demo_bot').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Detectar chat' }).click();
  await expect(dialog.getByText('Conectado', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: /^Avisos de Baphomet/ }).click();
  await page
    .getByRole('menuitemradio', { name: /Telegram/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Avisos de Baphomet: Telegram' })).toBeVisible();

  await page.getByRole('button', { name: /^Con avisos/ }).click();
  await expect(page.getByRole('heading', { name: 'Baphomet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pharaoh' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Avisos de Baphomet: Telegram' }).click();
  await page.getByRole('menuitemradio', { name: 'Sin avisos' }).click();
  // Con el filtro «Con avisos» activo, el MVP desaparece de la lista.
  await expect(
    page.getByText('Pulsa la campana de un MVP para elegir cómo avisarte.'),
  ).toBeVisible();
});
