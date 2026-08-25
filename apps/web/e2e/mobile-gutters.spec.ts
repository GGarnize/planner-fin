import { expect, test, type Page } from '@playwright/test';

const user = { id: 'u', name: 'Pessoa Teste', email: 'gutters@example.test', createdAt: '' };
const accounts = [
  { id: 'a', name: 'Conta origem', archivedAt: null },
  { id: 'b', name: 'Conta destino', archivedAt: null },
];
const category = { id: 'c', name: 'Moradia', type: 'EXPENSE', archivedAt: null };

const dashboard = {
  month: '2026-08',
  generatedAt: '2026-08-25T12:00:00.000Z',
  cashPosition: {
    totalRealizedBalance: '1500.00',
    availableAccountCount: 1,
    unavailableAccountCount: 0,
  },
  monthlyFlow: {
    incomeRealized: '2000.00',
    incomePlanned: '2500.00',
    expenseRealized: '800.00',
    expenseCommitted: '1000.00',
    realizedNet: '1200.00',
    plannedNet: '1500.00',
  },
  budget: null,
  upcomingTransactions: [
    {
      id: 't-dashboard',
      type: 'EXPENSE',
      description: 'Aluguel dashboard',
      plannedAmount: '1000.00',
      dueDate: '2026-09-05',
      categoryName: 'Moradia',
      overdue: false,
    },
    {
      id: 't-dashboard-income',
      type: 'INCOME',
      description: 'Salario dashboard',
      plannedAmount: '5000.00',
      dueDate: '2026-09-10',
      categoryName: 'Trabalho',
      overdue: false,
    },
  ],
  cardInvoices: [
    {
      invoiceId: 'invoice-dashboard',
      cardId: 'cc1',
      cardName: 'Cartao sintetico',
      referenceMonth: '2026-08',
      status: 'OPEN',
      total: '922.56',
      dueDate: '2026-09-05',
      projectedOverdue: false,
    },
  ],
  debtInstallments: [
    {
      debtId: 'debt-dashboard',
      installmentId: 'debt-installment-dashboard',
      creditorName: 'Credor sintetico',
      installmentNumber: 3,
      dueDate: '2026-09-05',
      totalAmount: '250.00',
      projectedStatus: 'OVERDUE',
      principalAmount: '250.00',
      interestAmount: '0.00',
      feeAmount: '0.00',
    },
  ],
  expenseByCategory: { categories: [], uncategorizedDebtCostRealized: '0.00' },
  counters: {
    overdueTransactions: 0,
    upcomingTransactions: 0,
    unpaidCardInvoices: 0,
    overdueDebtInstallments: 0,
    pendingNotificationReviews: 0,
  },
};

async function mockPlannerFin(page: Page) {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-sintetico' } }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      json: { accessToken: 'token-sintetico', csrfToken: 'csrf-sintetico', expiresIn: 900, user },
    }),
  );
  await page.route('**/api/dashboard?*', (route) => route.fulfill({ json: dashboard }));
  await page.route('**/api/financial-entries?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 'e1',
            source: 'TRANSACTION',
            sourceId: 't1',
            accountId: 'a',
            categoryId: 'c',
            type: 'EXPENSE',
            status: 'PENDING',
            description: 'Aluguel sintetico',
            amount: '1000.00',
            date: '2026-09-10',
            overdue: false,
            createdAt: '',
          },
        ],
        page: { limit: 20, nextCursor: null },
      },
    }),
  );
  await page.route('**/api/accounts?*', (route) => route.fulfill({ json: accounts }));
  await page.route('**/api/accounts', (route) => route.fulfill({ json: accounts }));
  await page.route('**/api/categories?*', (route) =>
    route.fulfill({
      json: [
        category,
        { id: 'income-category', name: 'Trabalho', type: 'INCOME', archivedAt: null },
      ],
    }),
  );
  await page.route('**/api/categories', (route) =>
    route.fulfill({
      json: [
        category,
        { id: 'income-category', name: 'Trabalho', type: 'INCOME', archivedAt: null },
      ],
    }),
  );
  await page.route('**/api/transfers?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 'tr1',
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
          id: 'r1',
          kind: 'TRANSACTION',
          status: 'ACTIVE',
          frequency: 'MONTHLY',
          transactionType: 'EXPENSE',
          accountId: 'a',
          categoryId: 'c',
          plannedAmount: '1000.00',
          description: 'Aluguel recorrente',
          notes: null,
          nextOccurrenceDate: '2026-09-10',
          attentionStatus: 'OK',
          archivedAt: null,
        },
      ],
    }),
  );
  await page.route('**/api/transaction-templates*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/budgets?*', (route) =>
    route.fulfill({
      json: {
        id: 'b1',
        month: '2026-08',
        totalLimit: '3000.00',
        notes: null,
        totals: {
          committedExpense: '1000.00',
          realizedExpense: '800.00',
          remainingAgainstCommitted: '2000.00',
          committedPercent: '33.33',
          realizedPercent: '26.67',
          unbudgetedRealizedExpense: '0.00',
          unbudgetedCommittedExpense: '0.00',
          uncategorizedDebtCostRealized: '0.00',
          uncategorizedDebtCostCommitted: '0.00',
        },
        categories: [],
      },
    }),
  );
  await page.route('**/api/cards?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'cc1',
            name: 'Cartao sintetico',
            issuer: 'Banco',
            last4: '1234',
            creditLimit: '2000.00',
            closingDay: 10,
            dueDay: 17,
            archivedAt: null,
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route('**/api/card-purchases?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route('**/api/card-invoices?*', (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
}

const pages = [
  { path: '/dashboard', pageSelector: '.dashboard', contentSelector: '.panel' },
  {
    path: '/transactions',
    pageSelector: '.transactions-page',
    contentSelector: '.transaction-card',
  },
  { path: '/categories', pageSelector: '.categories-page', contentSelector: '.category' },
  { path: '/transfers', pageSelector: '.transfers-page', contentSelector: '.list article' },
  { path: '/recurrences', pageSelector: '.recurrences', contentSelector: 'article' },
  { path: '/budgets', pageSelector: '.budgets', contentSelector: '.summary-panel' },
  { path: '/cards', pageSelector: '.cards-page', contentSelector: 'article' },
];

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

type BoxMetrics = {
  left: number;
  right: number;
  width: number;
  paddingLeft: number;
  paddingRight: number;
};

for (const viewport of viewports) {
  test(`gutter responsivo em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockPlannerFin(page);

    for (const target of pages) {
      await page.goto(target.path);
      await expect(page.locator(target.pageSelector)).toBeVisible();
      await expect(page.locator(target.contentSelector).first()).toBeVisible();

      const metrics = await page.evaluate(
        ({ pageSelector, contentSelector }) => {
          const box = (selector: string): BoxMetrics => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`Elemento nao encontrado: ${selector}`);
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              left: rect.left,
              right: innerWidth - rect.right,
              width: rect.width,
              paddingLeft: parseFloat(style.paddingLeft),
              paddingRight: parseFloat(style.paddingRight),
            };
          };
          return {
            scrollWidth: document.documentElement.scrollWidth,
            shell: box('.shell-content'),
            page: box(pageSelector),
            content: box(contentSelector),
          };
        },
        { pageSelector: target.pageSelector, contentSelector: target.contentSelector },
      );

      expect(metrics.scrollWidth, target.path).toBeLessThanOrEqual(viewport.width);

      if (target.path === '/dashboard') {
        await expect(page.locator('.dashboard')).not.toContainText(
          /\b(OPEN|INCOME|EXPENSE|OVERDUE)\b/,
        );
        await expect(page.locator('.dashboard')).not.toContainText(/\b2026-0[89](?:-\d{2})?\b/);
        await expect(page.getByText('Aberta')).toBeVisible();
        await expect(page.getByText('Cartao sintetico · Ago/2026')).toBeVisible();
      }

      if (target.path === '/categories' && viewport.width < 768) {
        await expect(page.getByText('Natureza', { exact: true })).toBeVisible();
        await expect(page.getByLabel('Natureza')).toBeVisible();
        await expect(page.getByLabel('Incluir arquivadas')).toBeVisible();
      }

      if (target.path === '/transactions' && viewport.width < 768) {
        const spacing = await page.evaluate(() => {
          const group = document.querySelector('.date-group');
          const heading = group?.querySelector('h2');
          const card = group?.querySelector('.transaction-card');
          if (!heading || !card) throw new Error('Grupo de lançamento incompleto');
          return card.getBoundingClientRect().top - heading.getBoundingClientRect().bottom;
        });
        expect(spacing, target.path).toBeLessThanOrEqual(8);
      }

      if (viewport.width < 768) {
        expect(metrics.shell.paddingLeft, target.path).toBeGreaterThanOrEqual(12);
        expect(metrics.shell.paddingLeft, target.path).toBeLessThanOrEqual(20);
        expect(metrics.page.left, target.path).toBeGreaterThanOrEqual(12);
        expect(metrics.page.left, target.path).toBeLessThanOrEqual(20);
        expect(metrics.page.right, target.path).toBeGreaterThanOrEqual(12);
        expect(metrics.page.right, target.path).toBeLessThanOrEqual(20);
        expect(metrics.page.paddingLeft, target.path).toBeLessThanOrEqual(1);
        expect(metrics.page.paddingRight, target.path).toBeLessThanOrEqual(1);
        expect(metrics.page.width, target.path).toBeGreaterThanOrEqual(viewport.width - 40);
        expect(metrics.content.left, target.path).toBeGreaterThanOrEqual(metrics.page.left - 1);
        expect(metrics.content.left, target.path).toBeLessThanOrEqual(metrics.page.left + 1);
      } else {
        expect(metrics.page.width, target.path).toBeGreaterThanOrEqual(700);
        expect(metrics.page.width, target.path).toBeLessThanOrEqual(1216);
      }
    }
  });
}
