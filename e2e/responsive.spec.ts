import { expect, test } from '@playwright/test';
import { login } from './helpers';

const widths = [1920, 1405, 1366, 1024, 768, 390];
const paths = [
  '/',
  '/mvp',
  '/mercados/vending',
  '/mercados/buscar?q=potion',
  '/noticias',
  '/wiki',
  '/wiki/Sistema_de_pesca',
  '/albumes/cartas',
  '/albumes/pesca',
];

test('ninguna pantalla tiene scroll horizontal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Recorre todos los anchos en un solo proyecto');
  test.setTimeout(120_000);
  await login(page);

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} a ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});
