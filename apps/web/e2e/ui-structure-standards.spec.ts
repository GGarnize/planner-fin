import { expect, test, type Page } from '@playwright/test';

const user = { id: 'u', name: 'Pessoa Teste', email: 'ui@example.test', createdAt: '' };
const accounts = [
  { id: 'a', name: 'Conta origem', type: 'CHECKING', archivedAt: null, realizedBalance: '100.00' },
  { id: 'b', name: 'Conta destino', type: 'CHECKING', archivedAt: null, realizedBalance: '50.00' },
];
const categories = [{ id: 'c', name: 'Moradia', type: 'EXPENSE', archivedAt: null }];
const card = {
  id: 'cc1',
  name: 'Cartao sintetico',
  issuer: 'Banco',
  last4: '1234',
  creditLimit: '2000.00',
  closingDay: 10,
  dueDay: 17,
  archivedAt: null,
};
const dashboard = {
  month: '2026-08',
  generatedAt: '',
  cashPosition: {
    totalRealizedBalance: '150.00',
    availableAccountCount: 2,
    unavailableAccountCount: 0,
  },
  monthlyFlow: {
    incomeRealized: '1000.00',
    incomePlanned: '1000.00',
    expenseRealized: '500.00',
    expenseCommitted: '600.00',
    realizedNet: '500.00',
    plannedNet: '400.00',
  },
  budget: {
    id: 'b',
    totalLimit: '1000.00',
    realizedExpense: '500.00',
    committedExpense: '600.00',
    remainingAgainstCommitted: '400.00',
    realizedPercent: '50.00',
    committedPercent: '60.00',
    exceeded: false,
  },
  upcomingTransactions: [],
  cardInvoices: [
    {
      invoiceId: 'i',
      cardId: 'cc1',
      cardName: 'Cartao sintetico',
      referenceMonth: '2026-08',
      status: 'OPEN',
      total: '90.00',
      dueDate: '2026-09-05',
      projectedOverdue: false,
    },
  ],
  debtInstallments: [
    {
      debtId: 'd',
      installmentId: 'di',
      creditorName: 'Credor sintetico',
      installmentNumber: 1,
      dueDate: '2026-09-05',
      totalAmount: '40.00',
      projectedStatus: 'PENDING',
      principalAmount: '40.00',
      interestAmount: '0.00',
      feeAmount: '0.00',
    },
  ],
  expenseByCategory: { categories: [], uncategorizedDebtCostRealized: '0.00' },
  counters: { pendingNotificationReviews: 0 },
};

async function mockPlannerFin(page: Page) {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: { csrfToken: 'csrf' } }));
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token', csrfToken: 'csrf', expiresIn: 900, user } }),
  );
  await page.route('**/api/dashboard?*', (route) => route.fulfill({ json: dashboard }));
  await page.route('**/api/accounts?*', (route) => route.fulfill({ json: accounts }));
  await page.route('**/api/accounts', (route) => route.fulfill({ json: accounts }));
  await page.route('**/api/categories?*', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/categories', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/cards?*', (route) =>
    route.fulfill({ json: { items: [card], nextCursor: null } }),
  );
  await page.route('**/api/cards', (route) =>
    route.fulfill({ json: { items: [card], nextCursor: null } }),
  );
  await page.route('**/api/card-purchases?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/api/card-invoices?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/api/debts?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'd',
            creditorName: 'Credor sintetico',
            type: 'LOAN',
            status: 'ACTIVE',
            installmentCount: 1,
            archivedAt: null,
            projections: { outstandingPrincipal: '40.00', nextInstallment: null },
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route('**/api/transfers?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 'tr',
            sourceAccountId: 'a',
            destinationAccountId: 'b',
            status: 'PENDING',
            description: 'Reserva sintetica',
            notes: null,
            plannedAmount: '25.00',
            actualAmount: null,
            dueDate: '2026-09-10',
            completedAt: null,
            isOverdue: false,
          },
        ],
        page: { limit: 20, nextCursor: null },
      },
    }),
  );
  await page.route('**/api/recurrences?*', (route) =>
    route.fulfill({
      json: [
        {
          id: 'r',
          kind: 'TRANSACTION',
          status: 'ACTIVE',
          frequency: 'MONTHLY',
          transactionType: 'EXPENSE',
          accountId: 'a',
          categoryId: 'c',
          plannedAmount: '500.00',
          description: 'Aluguel recorrente',
          notes: null,
          nextOccurrenceDate: '2026-09-10',
          attentionStatus: 'READY',
          archivedAt: null,
        },
      ],
    }),
  );
  await page.route('**/api/transaction-templates*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/imports?status=open', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/imports/session-1?*', (route) =>
    route.fulfill({
      json: {
        id: 'session-1',
        status: 'READY_FOR_REVIEW',
        draftVersion: 1,
        accountId: 'a',
        format: 'CSV',
        displayFileName: 'extrato.csv',
        rowCount: 0,
        rows: [],
        page: { filteredCount: 0 },
      },
    }),
  );
  await page.route('**/api/notification-preferences', (route) =>
    route.fulfill({ json: { captureEnabled: false, monitoredPackages: [] } }),
  );
  await page.route('**/api/notifications**', (route) => route.fulfill({ json: { data: [] } }));
}

async function forceDark(page: Page) {
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.dataset.accent = 'BLUE';
  });
}

async function expectSecondary(page: Page, parent: string) {
  await expect(page.getByLabel('Voltar')).toHaveCount(1);
  await expect(page.getByLabel('Voltar')).toHaveAttribute('href', parent);
  await expect(page.getByText('arrow_back')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(0);
  await expect(
    page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: /Mais/ }),
  ).toHaveAttribute('aria-current', 'page');
}

async function expectNoWhiteSurface(page: Page, selector: string) {
  const color = await page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(color).not.toBe('rgb(255, 255, 255)');
}

async function expectRealBackFromAccounts(page: Page, from: string, to: RegExp) {
  await page.goto(from);
  await page.getByRole('link', { name: /Contas/ }).first().click();
  await expect(page).toHaveURL(/\/accounts$/);
  await page.goBack();
  await expect(page).toHaveURL(to);
}

test('navegação mobile usa Up padronizado e FAB só nos destinos de topo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPlannerFin(page);
  await page.goto('/dashboard');
  await expect(page.getByLabel('Voltar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toBeVisible();
  await page.goto('/mais');
  await expect(page.getByLabel('Voltar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toBeVisible();

  const targets = [
    { label: 'Contas', path: /\/accounts$/, parent: '/mais' },
    { label: 'Categorias', path: /\/categories$/, parent: '/mais' },
    { label: 'Cartões', path: /\/cards$/, parent: '/mais' },
    { label: 'Dívidas', path: /\/debts$/, parent: '/mais' },
    { label: 'Transferências', path: /\/transfers$/, parent: '/mais' },
    { label: 'Recorrências', path: /\/recurrences$/, parent: '/mais' },
    { label: 'Modelos de lançamento', path: /\/transaction-templates$/, parent: '/mais' },
    { label: 'Importar extrato', path: /\/imports$/, parent: '/mais' },
    { label: 'Captura por notificações', path: /\/notifications$/, parent: '/mais' },
  ];

  for (const target of targets) {
    await page.goto('/mais');
    await page.getByRole('link', { name: new RegExp(target.label) }).click();
    await expect(page).toHaveURL(target.path);
    await expectSecondary(page, target.parent);
    await page.getByLabel('Voltar').click();
    await expect(page).toHaveURL(new RegExp(`${target.parent}$`));
  }

  await page.goto('/imports/session-1');
  await expectSecondary(page, '/imports');
  await page.goto('/notifications/inbox');
  await expectSecondary(page, '/notifications');
});

test('Back preserva histÃ³rico real e Up de Contas usa Mais', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPlannerFin(page);

  await expectRealBackFromAccounts(page, '/dashboard', /\/dashboard$/);
  await expectRealBackFromAccounts(page, '/mais', /\/mais$/);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /Contas/ }).first().click();
  await expect(page.getByLabel('Voltar')).toHaveAttribute('href', '/mais');
  await page.getByLabel('Voltar').click();
  await expect(page).toHaveURL(/\/mais$/);
});

test('dark mode mantém superfícies legíveis em Transferências, Recorrências, Modelos e Importação', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockPlannerFin(page);

  await page.goto('/transfers');
  await forceDark(page);
  await expect(page.locator('.list article')).toBeVisible();
  await expectNoWhiteSurface(page, '.list article');
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(0);

  await page.goto('/recurrences');
  await forceDark(page);
  await expectNoWhiteSurface(page, 'article');
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.getByRole('button', { name: 'Nova recorrência' }).first().click();
  await expect(page.getByRole('heading', { name: 'Nova recorrência' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expectNoWhiteSurface(page, '.form-panel');
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(0);

  await page.goto('/transaction-templates');
  await forceDark(page);
  await expectNoWhiteSurface(page, '.empty');
  await page.getByRole('button', { name: 'Novo modelo' }).click();
  await expectNoWhiteSurface(page, 'form[role="dialog"]');
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(0);

  await page.goto('/imports');
  await forceDark(page);
  await expect(page.getByRole('heading', { name: 'Importar extrato' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(0);
});

test('Dashboard usa CTAs padronizados e ações rápidas coerentes no dark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPlannerFin(page);
  await page.goto('/dashboard');
  await forceDark(page);

  for (const label of ['Ver Orçamento', 'Ver cartões', 'Ver dívidas']) {
    const link = page.getByRole('link', { name: new RegExp(label) });
    await expect(link).toBeVisible();
    await expect(link).toHaveClass(/panel-action-link/);
  }
  await expect(page.locator('.actions .panel-action-link')).toHaveCount(5);
  await expectNoWhiteSurface(page, '.panel');
});
