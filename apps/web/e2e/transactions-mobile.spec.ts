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
  await page.route('**/api/cards', (r) => r.fulfill({ json: { items: [], nextCursor: null } }));
  await page.route('**/api/transaction-templates*', (r) =>
    r.fulfill({ json: r.request().method() === 'GET' ? [template] : template }),
  );
  await page.route('**/api/transactions?*', (r) =>
    r.fulfill({ json: { data: [], page: { limit: 20, nextCursor: null } } }),
  );
  await page.route('**/api/transactions', (r) => r.fulfill({ status: 201, json: {} }));
});

for (const viewport of [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
]) {
  test(`período de lançamentos usa duas colunas em ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: viewport.width === 390 ? 'dark' : 'light' });
    await page.clock.setFixedTime(new Date('2026-08-12T15:00:00-03:00'));
    await page.goto('/transactions');
    await page.getByRole('button', { name: /Filtros/ }).click();

    const period = page.locator('.date-range-filter');
    await expect(period.getByText('Período', { exact: true })).toBeVisible();
    const inputs = period.locator('input[type="date"]');
    await expect(inputs).toHaveCount(2);
    await expect(inputs.nth(0)).toHaveValue('2026-08-01');
    await expect(inputs.nth(1)).toHaveValue('2026-08-31');
    const fromBox = await inputs.nth(0).boundingBox();
    const toBox = await inputs.nth(1).boundingBox();
    expect(fromBox).not.toBeNull();
    expect(toBox).not.toBeNull();
    expect(Math.abs(fromBox!.y - toBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(fromBox!.width - toBox!.width)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

    const colors = await inputs.nth(0).evaluate((input) => {
      const style = getComputedStyle(input);
      return { background: style.backgroundColor, color: style.color, border: style.borderColor };
    });
    expect(colors.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(colors.color).not.toBe(colors.background);
    expect(colors.border).not.toBe('rgba(0, 0, 0, 0)');

    await page.screenshot({
      path: testInfo.outputPath(`transactions-period-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

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
  await page.getByRole('button', { name: 'Novo lançamento' }).click();
  const newTransactionDialog = page.getByRole('dialog', { name: 'Novo lançamento' });
  await expect(newTransactionDialog).toBeVisible();
  await newTransactionDialog.getByRole('button', { name: 'Despesa', exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\/new\?type=EXPENSE$/);
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
