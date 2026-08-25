import { expect, test, type Page } from '@playwright/test';

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

type Recurrence = Record<string, unknown>;

const recurrence = (overrides: Partial<Recurrence> = {}): Recurrence => ({
  id: 'r1',
  kind: 'TRANSACTION',
  transactionType: 'EXPENSE',
  frequency: 'MONTHLY',
  dayOfMonth: 10,
  startDate: '2026-09-01',
  endDate: null,
  accountId: 'a',
  categoryId: 'c',
  plannedAmount: '1923.00',
  description: 'Aluguel sintético',
  notes: null,
  status: 'ACTIVE',
  nextOccurrenceDate: '2026-10-10',
  attentionStatus: 'READY',
  blockedReason: null,
  blockedResourceType: null,
  blockedResourceId: null,
  blockedAt: null,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

async function mockPlannerFin(page: Page, recurrences: Recurrence[]) {
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
  await page.route('**/api/recurrences?*', (route) => route.fulfill({ json: recurrences }));
  await page.route('**/api/recurrences', async (route) => {
    const body = route.request().postDataJSON();
    recurrences.splice(0, recurrences.length, recurrence({ ...body, id: 'r1' }));
    await route.fulfill({ status: 201, json: recurrences[0] });
  });
  await page.route('**/api/recurrences/r1', async (route) => {
    const body = route.request().postDataJSON();
    recurrences.splice(0, recurrences.length, recurrence({ ...recurrences[0], ...body }));
    await route.fulfill({ json: recurrences[0] });
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
  test(`recorrências list-first e formulário dedicado em ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const recurrences: Recurrence[] = [];
    await page.setViewportSize(viewport);
    await mockPlannerFin(page, recurrences);
    await page.goto('/recurrences');

    await expect(page.getByRole('heading', { name: 'Suas recorrências' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nova recorrência' })).toHaveCount(0);
    await expect(page.getByText('Nenhuma recorrência cadastrada')).toBeVisible();
    await expectNoHorizontalOverflow(page, viewport.width);

    await page.getByRole('button', { name: 'Nova recorrência' }).first().click();
    await expect(page.getByRole('heading', { name: 'Nova recorrência' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Suas recorrências' })).toHaveCount(0);
    await page.getByLabel('Descrição').fill('Rascunho protegido');
    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByRole('dialog', { name: 'Descartar alterações?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.getByLabel('Descrição')).toHaveValue('Rascunho protegido');

    await page.getByRole('button', { name: 'Usar modelo...' }).click();
    await page.getByRole('button', { name: /Aluguel Aluguel sintético/ }).click();
    await expect(page.getByRole('dialog', { name: 'Substituir campos?' })).toBeVisible();
    await page.getByRole('button', { name: 'Aplicar modelo' }).click();
    await expect(page.getByLabel('Descrição')).toHaveValue('Aluguel sintético');
    await page.getByLabel('Valor planejado').fill('1923');
    await expectNoHorizontalOverflow(page, viewport.width);
    await expect(page.getByRole('button', { name: 'Salvar recorrência' })).toBeVisible();

    const createRequest = page.waitForRequest(
      (candidate) => candidate.url().endsWith('/api/recurrences') && candidate.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Salvar recorrência' }).click();
    const createBody = (await createRequest).postDataJSON();
    expect(createBody.plannedAmount).toBe('1923.00');
    expect(createBody).not.toHaveProperty('templateId');
    expect(createBody).not.toHaveProperty('sourceTemplateId');
    await expect(page.getByRole('heading', { name: 'Suas recorrências' })).toBeVisible();
    await expect(page.getByText('Aluguel sintético')).toBeVisible();

    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar recorrência' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Suas recorrências' })).toHaveCount(0);
    await page.getByLabel('Descrição').fill('Aluguel ajustado');
    const editRequest = page.waitForRequest(
      (candidate) =>
        candidate.url().endsWith('/api/recurrences/r1') && candidate.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Salvar recorrência' }).click();
    expect((await editRequest).postDataJSON().description).toBe('Aluguel ajustado');
    await expect(page.getByText('Aluguel ajustado')).toBeVisible();
    await expectNoHorizontalOverflow(page, viewport.width);

    await page.screenshot({
      path: testInfo.outputPath(`recurrences-list-first-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
