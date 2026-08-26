import { expect, test, type Page } from '@playwright/test';

const user = { id: 'u', name: 'Pessoa Teste', email: 'debts@example.test', createdAt: '' };
const accounts = [
  { id: 'a', name: 'Conta corrente', type: 'CHECKING', archivedAt: null, realizedBalance: '1000.00' },
];
const installment = {
  id: 'installment-1',
  debtId: 'debt-1',
  installmentNumber: 1,
  dueDate: '2028-03-29',
  principalAmount: '500.00',
  interestAmount: '10.00',
  feeAmount: '0.00',
  totalAmount: '510.00',
  status: 'PENDING',
  projectedStatus: 'OVERDUE',
  paidAt: null,
};
const projections = {
  outstandingPrincipal: '1000.00',
  paidPrincipal: '0.00',
  paidInterestAmount: '0.00',
  paidFeeAmount: '0.00',
  pendingInterestAmount: '20.00',
  pendingFeeAmount: '0.00',
  totalFutureAmount: '1020.00',
  overdueInstallmentCount: 1,
  nextInstallment: installment,
  projectedStatus: 'ACTIVE',
};
const debt = {
  id: 'debt-1',
  type: 'FINANCING',
  creditorName: 'Credor sintetico',
  description: 'Contrato sintetico',
  notes: null,
  originalPrincipal: '1000.00',
  startDate: '2028-02-29',
  installmentCount: 2,
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
  projections,
};
const detail = {
  ...debt,
  funding: null,
  installments: [
    installment,
    {
      ...installment,
      id: 'installment-2',
      installmentNumber: 2,
      dueDate: '2028-04-29',
      projectedStatus: 'PENDING',
    },
  ],
  payments: [],
};

async function mockPlannerFin(page: Page) {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: { csrfToken: 'csrf' } }));
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token', csrfToken: 'csrf', expiresIn: 900, user } }),
  );
  await page.route('**/api/accounts', (route) => route.fulfill({ json: accounts }));
  await page.route('**/api/debts?*', (route) =>
    route.fulfill({ json: { items: [debt], nextCursor: null } }),
  );
  await page.route('**/api/debts/debt-1', (route) => route.fulfill({ json: detail }));
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
  test(`Dívidas mobile em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockPlannerFin(page);

    await page.goto('/mais');
    await page.getByRole('link', { name: /Dívidas/ }).click();
    await expect(page).toHaveURL(/\/debts$/);
    await expect(page.getByLabel('Voltar')).toHaveAttribute('href', '/mais');
    await expect(page.getByText('Credor sintetico')).toBeVisible();
    await expect(page.getByText('Saldo devedor')).toBeVisible();
    await expect(page.getByText('Próxima parcela')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir detalhe' })).toBeVisible();
    await expectNoHorizontalOverflow(page, viewport.width);

    await page.getByRole('button', { name: 'Abrir detalhe' }).click();
    await expect(page).toHaveURL(/\/debts\/debt-1$/);
    await expect(page.getByLabel('Voltar')).toHaveAttribute('href', '/debts');
    await expect(page.getByText('Quanto falta')).toBeVisible();
    await expect(page.getByText('Situação')).toBeVisible();
    await expect(page.getByText('2 parcela(s) pendente(s)')).toBeVisible();
    await expect(page.locator('.schedule').first().getByText('Vencimento')).toBeVisible();
    await expect(page.locator('.schedule').first().getByText('Valor')).toBeVisible();
    await expectNoHorizontalOverflow(page, viewport.width);

    await page.getByLabel('Voltar').click();
    await expect(page).toHaveURL(/\/debts$/);
    await page.getByLabel('Voltar').click();
    await expect(page).toHaveURL(/\/mais$/);
  });
}

test('formulário de dívida é focado e fecha por Escape no mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPlannerFin(page);
  await page.goto('/debts');

  await page.getByRole('button', { name: 'Nova dívida' }).click();
  await expect(page.getByRole('dialog', { name: 'Novo contrato' })).toBeVisible();
  await expect(page.getByLabel('Credor')).toBeVisible();
  await expectNoHorizontalOverflow(page, 390);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Novo contrato' })).toHaveCount(0);
});
