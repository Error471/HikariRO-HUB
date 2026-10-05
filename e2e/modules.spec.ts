import { expect, test } from '@playwright/test';
import { collectPageErrors, login } from './helpers';

const pages = [
  { path: '/', heading: /demo/i },
  { path: '/mvp', heading: 'MVP Timer' },
  { path: '/mercados/vending', heading: 'Vending' },
  { path: '/mercados/buying-store', heading: 'Buying Store' },
  { path: '/mercados/buscar?q=potion', heading: 'Buscar item' },
  { path: '/noticias', heading: 'Noticias' },
  { path: '/wiki', heading: 'Wiki' },
  { path: '/albumes/cartas', heading: 'Cartas' },
  { path: '/albumes/pesca', heading: 'Pesca' },
  { path: '/diagnostico', heading: 'Diagnóstico' },
];

test('todos los módulos cargan sin errores', async ({ page }) => {
  const errors = collectPageErrors(page);
  await login(page);
  for (const { path, heading } of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('el álbum de cartas guarda filtros y página en la URL', async ({ page }) => {
  await login(page, '/albumes/cartas');
  await page.getByRole('button', { name: /Faltantes/ }).click();
  await expect(page).toHaveURL(/status=missing/);
  await page.getByRole('button', { name: 'Página 2' }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Faltantes/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('una ruta inexistente muestra la página de error', async ({ page }) => {
  await login(page);
  await page.goto('/no-existe');
  await expect(page.getByText('Esta zona no aparece en el mapa')).toBeVisible();
});

test('al borrar la búsqueda se vuelve a la página de origen', async ({ page }) => {
  await login(page, '/wiki');
  const wikiSearch = page.getByRole('searchbox', { name: 'Buscar en la wiki' });
  await wikiSearch.fill('pesca');
  await expect(page).toHaveURL(/\/wiki\/buscar\?q=pesca/);
  await page.getByRole('searchbox', { name: 'Buscar en la wiki' }).fill('');
  await expect(page).toHaveURL(/\/wiki$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Wiki' })).toBeVisible();

  await page.goto('/mercados/vending');
  const marketSearch = page.getByRole('searchbox', { name: 'Buscar item en todos los mercados' });
  await marketSearch.fill('potion');
  await expect(page).toHaveURL(/\/mercados\/buscar\?q=potion/);
  await page.getByRole('searchbox', { name: 'Buscar item en todos los mercados' }).fill('');
  await expect(page).toHaveURL(/\/mercados\/vending(\?.*)?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Vending' })).toBeVisible();
});

test('la búsqueda global (Ctrl+K) lleva a un MVP y a la wiki', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { level: 1, name: /demo/i })).toBeVisible();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Búsqueda global' });
  await expect(dialog).toBeVisible();
  // El diagnóstico no se lista como una sección más: solo aparece al buscarlo.
  await expect(dialog.getByRole('option', { name: 'Diagnóstico' })).toHaveCount(0);
  await dialog.getByRole('combobox').fill('diagnos');
  await expect(dialog.getByRole('option', { name: 'Diagnóstico' })).toBeVisible();
  await dialog.getByRole('combobox').fill('baph');
  await dialog.getByRole('option', { name: /Baphomet/ }).click();
  await expect(page).toHaveURL(/\/mvp\?q=Baphomet/);
  await expect(page.getByRole('searchbox', { name: 'Buscar MVP o mapa' })).toHaveValue('Baphomet');

  await page.getByRole('button', { name: 'Buscar' }).first().click();
  await dialog.getByRole('combobox').fill('poring');
  await dialog.getByRole('option', { name: 'Poring Village' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Poring Village' })).toBeVisible();
});

test('el diagnóstico muestra el estado de HikariRO tras usar la app', async ({ page }) => {
  await login(page, '/mvp');
  await expect(page.getByRole('link', { name: 'Diagnóstico' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'MVP Timer' })).toBeVisible();
  await page.goto('/diagnostico');
  const mvp = page.getByRole('main').getByRole('listitem').filter({ hasText: 'MVP Timer' });
  await expect(mvp).toContainText('Funciona');
  await expect(page.getByRole('button', { name: 'Copiar diagnóstico' })).toBeEnabled();
});
