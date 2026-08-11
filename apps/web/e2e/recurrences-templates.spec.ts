import { expect, test } from '@playwright/test';

const user = { id: 'u', name: 'Pessoa Teste', email: 'recorrencias@example.test', createdAt: '' };
const template = {
  id: 't',
  name: 'Aluguel',
  type: 'EXPENSE',
  categoryId: 'c',
  categoryAvailable: true,
  description: 'Aluguel sintético',
  plannedAmount: '1800.00',
  defaultAccountId: 'a',
  defaultAccountAvailable: true,
  notes: null,
  dueDay: 10,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-sintetico' } }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/accounts?*', (route) =>
    route.fulfill({ json: [{ id: 'a', name: 'Conta sintética', archivedAt: null }] }),
  );
  await page.route('**/api/categories?*', (route) =>
    route.fulfill({
      json: [{ id: 'c', name: 'Moradia', type: 'EXPENSE', archivedAt: null }],
    }),
  );
  await page.route('**/api/transaction-templates', (route) => route.fulfill({ json: [template] }));
  await page.route('**/api/recurrences?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/recurrences', (route) => route.fulfill({ status: 201, json: {} }));
});

for (const viewport of [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`recorrência via modelo é independente no ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/recurrences');
    await page.getByRole('button', { name: 'Usar modelo...' }).click();
    await page.getByRole('button', { name: /Aluguel Aluguel sintético/ }).click();
    await expect(page.getByLabel('Descrição')).toHaveValue('Aluguel sintético');
    await page.getByLabel('Valor planejado').fill('1923');
    const request = page.waitForRequest(
      (candidate) => candidate.url().endsWith('/api/recurrences') && candidate.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Salvar recorrência' }).click();
    const body = (await request).postDataJSON();
    expect(body.plannedAmount).toBe('1923.00');
    expect(body).not.toHaveProperty('templateId');
    expect(body).not.toHaveProperty('sourceTemplateId');
    expect(template.plannedAmount).toBe('1800.00');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.screenshot({
      path: testInfo.outputPath(`recurrences-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
