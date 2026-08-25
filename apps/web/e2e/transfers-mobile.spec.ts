import { expect, test, type Page } from '@playwright/test';

const user = { id: 'u', name: 'Pessoa Teste', email: 'transfers@example.test', createdAt: '' };
const accounts = [
  { id: 'a', name: 'Conta origem', archivedAt: null },
  { id: 'b', name: 'Conta destino', archivedAt: null },
];

type Transfer = Record<string, unknown>;

const transfer = (overrides: Partial<Transfer> = {}): Transfer => ({
  id: 't1',
  sourceAccountId: 'a',
  destinationAccountId: 'b',
  status: 'PENDING',
  description: 'Reserva sintetica',
  notes: null,
  plannedAmount: '100.00',
  actualAmount: null,
  dueDate: '2026-09-10',
  completedAt: null,
  isOverdue: false,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

async function mockPlannerFin(page: Page, transfers: Transfer[]) {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-sintetico' } }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/accounts', (route) => route.fulfill({ json: accounts }));
  await page.route('**/api/transfers?*', (route) =>
    route.fulfill({ json: { data: transfers, page: { limit: 20, nextCursor: null } } }),
  );
  await page.route('**/api/transfers', async (route) => {
    const body = route.request().postDataJSON();
    transfers.splice(
      0,
      transfers.length,
      transfer({
        ...body,
        id: 't1',
        actualAmount: body.actualAmount ?? null,
        completedAt: body.completedAt ?? null,
        isOverdue: false,
      }),
    );
    await route.fulfill({ status: 201, json: transfers[0] });
  });
  await page.route('**/api/transfers/t1', async (route) => {
    const body = route.request().postDataJSON();
    transfers.splice(0, transfers.length, transfer({ ...transfers[0], ...body }));
    await route.fulfill({ json: transfers[0] });
  });
}

async function expectNoHorizontalOverflow(page: Page, width: number) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(width);
}

for (const viewport of [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
]) {
  test(`transferencias mobile-first em ${viewport.name}`, async ({ page }, testInfo) => {
    const transfers: Transfer[] = [];
    await page.setViewportSize(viewport);
    await mockPlannerFin(page, transfers);
    await page.goto('/transfers');

    await expect(page.getByText('Nenhuma transferência cadastrada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova transferência' })).toBeVisible();
    await expect(page.locator('#transfer-secondary-filters')).toBeHidden();
    await expectNoHorizontalOverflow(page, viewport.width);

    await page.getByLabel('Vencimento inicial').fill('2026-09-01');
    await page.getByRole('button', { name: /Mais filtros/ }).click();
    await expect(page.locator('#transfer-secondary-filters')).toBeVisible();
    await page.locator('#transfer-secondary-filters select').first().selectOption('a');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText('2 filtros ativos')).toBeVisible();
    await expect(page.getByRole('button', { name: /Mais filtros/ })).toContainText('1');
    await page
      .getByRole('region', { name: 'Filtros' })
      .getByRole('button', { name: 'Limpar filtros' })
      .click();
    await expect(page.getByText('filtros ativos')).toHaveCount(0);

    await page.getByRole('button', { name: 'Nova transferência' }).click();
    await expect(page.getByRole('dialog', { name: 'Transferencia' })).toBeVisible();
    await page.getByLabel('Descrição').fill('Rascunho protegido');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog', { name: 'Descartar alteracoes' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.getByLabel('Descrição')).toHaveValue('Rascunho protegido');
    await page.getByLabel('Descrição').fill('Reserva sintetica');

    const formDialog = page.getByRole('dialog', { name: 'Transferencia' });
    await formDialog.locator('select').nth(0).selectOption('a');
    await formDialog.locator('select').nth(1).selectOption('b');
    await formDialog.getByLabel('Valor previsto').fill('100');
    await formDialog.getByLabel('Vencimento').fill('2026-09-10');
    await expect(page.getByRole('button', { name: 'Salvar transferencia' })).toBeVisible();
    const createRequest = page.waitForRequest(
      (candidate) => candidate.url().endsWith('/api/transfers') && candidate.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Salvar transferencia' }).click();
    expect((await createRequest).postDataJSON().plannedAmount).toBe('100.00');
    await expect(page.getByText('Reserva sintetica')).toBeVisible();

    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog', { name: 'Transferencia' })).toBeVisible();
    await page.getByLabel('Descrição').fill('Reserva ajustada');
    const editRequest = page.waitForRequest(
      (candidate) =>
        candidate.url().endsWith('/api/transfers/t1') && candidate.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Salvar transferencia' }).click();
    expect((await editRequest).postDataJSON().description).toBe('Reserva ajustada');
    await expect(page.getByText('Reserva ajustada')).toBeVisible();

    await expectNoHorizontalOverflow(page, viewport.width);
    await page.screenshot({
      path: testInfo.outputPath(`transfers-mobile-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
