import { expect, test } from '@playwright/test';
const user = { id: 'u', name: 'Pessoa Teste', email: 'teste@example.test', createdAt: '' };
const account = { id: 'a', name: 'Conta sintética', archivedAt: null };
const category = { id: 'c', name: 'Moradia', type: 'EXPENSE', archivedAt: null };
const template = {
  id: 't',
  name: 'Aluguel',
  type: 'EXPENSE',
  categoryId: 'c',
  categoryAvailable: true,
  description: 'Aluguel sintético',
  plannedAmount: '1000.00',
  defaultAccountId: 'a',
  defaultAccountAvailable: true,
  notes: null,
  dueDay: 31,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/csrf', (r) => r.fulfill({ json: { csrfToken: 'csrf-sintetico' } }));
  await page.route('**/api/auth/refresh', (r) =>
    r.fulfill({ json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/accounts', (r) => r.fulfill({ json: [account] }));
  await page.route('**/api/categories', (r) => r.fulfill({ json: [category] }));
  await page.route('**/api/transaction-templates*', (r) =>
    r.fulfill({ json: r.request().method() === 'GET' ? [template] : template }),
  );
  await page.route('**/api/transactions?*', (r) =>
    r.fulfill({ json: { data: [], page: { limit: 20, nextCursor: null } } }),
  );
  await page.route('**/api/transactions', (r) => r.fulfill({ status: 201, json: {} }));
});
test('lançamentos mobile priorizam lista e modelo apenas copia o rascunho', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/transactions');
  await expect(page.getByRole('button', { name: /Filtros/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByRole('heading', { name: 'Nenhum resultado para os filtros' })).toBeVisible();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await expect(page).toHaveURL(/transactions\/new/);
  await page.getByRole('button', { name: 'Usar modelo...' }).click();
  await page.getByRole('button', { name: /Aluguel.*Aluguel sintético/ }).click();
  await expect(page.getByLabel('Descrição')).toHaveValue('Aluguel sintético');
  await page.getByLabel('Valor previsto').fill('1200');
  const post = page.waitForRequest(
    (r) => r.url().endsWith('/api/transactions') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Salvar' }).click();
  expect((await post).postDataJSON()).not.toHaveProperty('templateId');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.screenshot({ path: testInfo.outputPath('transactions-mobile.png'), fullPage: true });
});
test('gestão de modelos permanece utilizável no desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/transaction-templates');
  await expect(page.getByText('Aluguel', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo modelo' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
});
