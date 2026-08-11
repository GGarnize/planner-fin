import { expect, test } from '@playwright/test';

const user = {
  id: '00000000-0000-4000-8000-000000000013',
  name: 'Pessoa Teste',
  email: 'mobile@example.test',
  createdAt: '2026-08-11T12:00:00.000Z',
};
const dashboard = {
  month: '2026-08',
  generatedAt: '2026-08-11T12:00:00.000Z',
  cashPosition: {
    totalRealizedBalance: '1500.00',
    availableAccountCount: 2,
    unavailableAccountCount: 0,
  },
  monthlyFlow: {
    incomeRealized: '1950.00',
    incomePlanned: '3000.00',
    expenseRealized: '705.00',
    expenseCommitted: '1025.00',
    realizedNet: '1245.00',
    plannedNet: '1975.00',
  },
  budget: null,
  upcomingTransactions: [],
  cardInvoices: [],
  debtInstallments: [],
  expenseByCategory: { categories: [], uncategorizedDebtCostRealized: '0.00' },
  counters: {
    overdueTransactions: 0,
    upcomingTransactions: 0,
    unpaidCardInvoices: 0,
    overdueDebtInstallments: 0,
  },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-sintetico' } }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/dashboard?*', (route) => route.fulfill({ json: dashboard }));
});

test('shell mobile mantém primeira dobra, navegação e conteúdo livres da barra', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/dashboard');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(nav.getByRole('link', { name: /Início/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Posição atual')).toBeVisible();
  await expect(page.getByText('Resumo do mês')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Transferir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toBeVisible();
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    navTop: document.querySelector('.bottom-nav')!.getBoundingClientRect().top,
    contentBottom: document.querySelector('.shell-content')!.getBoundingClientRect().bottom,
  }));
  expect(metrics.width).toBe(metrics.viewport);
  expect(metrics.contentBottom).toBeGreaterThan(metrics.navTop);
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true });
  await nav.getByRole('link', { name: /Mais/ }).click();
  await expect(page).toHaveURL(/\/mais$/);
  await expect(page.getByRole('link', { name: /Transferências/ })).toBeVisible();
});

test('desktop usa navegação superior e não exibe bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');
  await expect(page.locator('.desktop-header')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
});
