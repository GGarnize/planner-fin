import { expect, test } from '@playwright/test';

const user = {
  id: '00000000-0000-4000-8000-000000000099',
  name: 'Pessoa Orçamento',
  email: 'orcamento@example.test',
  createdAt: '2026-08-23T12:00:00.000Z',
};

const categories = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Mercado e alimentação cotidiana',
    type: 'EXPENSE',
    color: '#336699',
    icon: 'RESTAURANT',
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
  },
];

const projected = {
  id: '00000000-0000-4000-8000-000000000010',
  month: '2026-08',
  totalLimit: '5000.50',
  notes: null,
  totals: {
    realizedExpense: '1200.00',
    committedExpense: '1800.00',
    remainingAgainstRealized: '3800.50',
    remainingAgainstCommitted: '3200.50',
    realizedPercent: '24.00',
    committedPercent: '36.00',
    unbudgetedRealizedExpense: '200.00',
    unbudgetedCommittedExpense: '300.00',
    uncategorizedDebtCostRealized: '0.00',
    uncategorizedDebtCostCommitted: '0.00',
  },
  categories: [
    {
      categoryId: categories[0]!.id,
      categoryName: categories[0]!.name,
      categoryArchived: false,
      limitAmount: '1200.00',
      realizedExpense: '1000.00',
      committedExpense: '1500.00',
      remainingAgainstRealized: '200.00',
      remainingAgainstCommitted: '-300.00',
      realizedPercent: '83.33',
      committedPercent: '125.00',
    },
  ],
  createdAt: '',
  updatedAt: '',
};

test('REPRODUÇÃO: orçamento em viewports alvo, payload e CTA com viewport reduzido', async ({
  page,
}, testInfo) => {
  let created = false;
  let sentPayload: unknown;
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-sintetico' } }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/categories?*', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/budgets?*', (route) =>
    route.fulfill(created ? { json: projected } : { status: 404, json: { error: {} } }),
  );
  await page.route('**/api/budgets', async (route) => {
    sentPayload = route.request().postDataJSON();
    created = true;
    await route.fulfill({ status: 201, json: projected });
  });

  const metrics: unknown[] = [];
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/budgets');
    await expect(page.getByRole('heading', { name: /Orçamento mensal/ })).toBeVisible();
    metrics.push(
      await page.evaluate((size) => {
        const rect = (selector: string) => {
          const element = document.querySelector(selector);
          const box = element?.getBoundingClientRect();
          return box
            ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width }
            : null;
        };
        return {
          phase: 'view',
          viewport: size,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          innerWidth,
          innerHeight,
          fabDisplay: getComputedStyle(document.querySelector('.global-fab')!).display,
          bottomNavDisplay: getComputedStyle(document.querySelector('.bottom-nav')!).display,
          categoryRow: rect('.category-row'),
          categoryContent: rect('.category-content'),
        };
      }, viewport),
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }

  created = true;
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/budgets');
    await expect(page.getByRole('heading', { name: 'Resumo' })).toBeVisible();
    metrics.push(
      await page.evaluate((size) => {
        const row = document.querySelector('.category-row') as HTMLElement;
        const content = document.querySelector('.category-content') as HTMLElement;
        const rowBox = row.getBoundingClientRect();
        const contentBox = content.getBoundingClientRect();
        return {
          phase: 'list',
          viewport: size,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          innerWidth,
          innerHeight,
          categoryRowWidth: rowBox.width,
          categoryContentWidth: contentBox.width,
          categoryRowPaddingRight: getComputedStyle(row).paddingRight,
          fabDisplay: getComputedStyle(document.querySelector('.global-fab')!).display,
          bottomNavDisplay: getComputedStyle(document.querySelector('.bottom-nav')!).display,
        };
      }, viewport),
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }

  created = false;
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/budgets');
  await page.getByRole('button', { name: 'Criar orçamento' }).click();
  await page.getByPlaceholder('5.000,00').fill('5.000,50');
  await page.setViewportSize({ width: 360, height: 480 });
  const save = page.getByRole('button', { name: 'Salvar' });
  metrics.push(
    await page.evaluate(() => {
      const action = document.querySelector('.form-actions')!.getBoundingClientRect();
      return {
        phase: 'editing-keyboard-simulated',
        viewport: { width: innerWidth, height: innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollY,
        actionTop: action.top,
        actionBottom: action.bottom,
        fabDisplay: getComputedStyle(document.querySelector('.global-fab')!).display,
        bottomNavDisplay: getComputedStyle(document.querySelector('.bottom-nav')!).display,
      };
    }),
  );
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeVisible();
  const post = page.waitForRequest(
    (request) => request.url().endsWith('/api/budgets') && request.method() === 'POST',
  );
  await save.click();
  sentPayload = (await post).postDataJSON();
  expect(sentPayload).toMatchObject({
    month: '2026-08',
    totalLimit: '5000.50',
    notes: null,
    categories: [],
  });

  await testInfo.attach('budgets-mobile-reproduction-metrics.json', {
    body: Buffer.from(JSON.stringify({ metrics, sentPayload }, null, 2)),
    contentType: 'application/json',
  });
});
