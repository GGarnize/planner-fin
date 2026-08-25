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

test('TO-BE: orçamento responsivo, criação, edição e CTA sem sobreposição', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  let currentBudget: typeof projected | null = null;
  let sentPayload: unknown;
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-sintetico' } }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/categories?*', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/budgets?*', (route) =>
    route.fulfill(currentBudget ? { json: currentBudget } : { status: 404, json: { error: {} } }),
  );
  await page.route('**/api/budgets', async (route) => {
    sentPayload = route.request().postDataJSON();
    currentBudget = projected;
    await route.fulfill({ status: 201, json: currentBudget });
  });
  await page.route('**/api/budgets/*', async (route) => {
    sentPayload = route.request().postDataJSON();
    currentBudget = {
      ...projected,
      totalLimit: String((sentPayload as { totalLimit: string }).totalLimit),
    };
    await route.fulfill({ json: currentBudget });
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

  currentBudget = projected;
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
    expect(
      await page.locator('.category-row').evaluate((row) => getComputedStyle(row).paddingRight),
    ).toBe('0px');
  }

  currentBudget = null;
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

  for (const [index, viewport] of viewports.entries()) {
    await page.setViewportSize(viewport);
    await page.goto('/budgets');
    await page.getByRole('button', { name: 'Editar orçamento' }).click();
    const total = page.getByPlaceholder('5.000,00');
    await total.fill(`${5100 + index},00`);
    const editMetrics = await page.evaluate((size) => {
      const shellContent = document.querySelector('.shell-content') as HTMLElement;
      const form = document.querySelector('.budget-form') as HTMLElement;
      const action = document.querySelector('.form-actions') as HTMLElement;
      return {
        phase: 'edit',
        viewport: size,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        shellPaddingBottom: getComputedStyle(shellContent).paddingBottom,
        formWidth: form.getBoundingClientRect().width,
        actionBottom: action.getBoundingClientRect().bottom,
        fabDisplay: getComputedStyle(document.querySelector('.global-fab')!).display,
        bottomNavDisplay: getComputedStyle(document.querySelector('.bottom-nav')!).display,
      };
    }, viewport);
    metrics.push(editMetrics);
    expect(editMetrics.scrollWidth).toBe(viewport.width);
    expect(editMetrics.fabDisplay).toBe('none');
    if (viewport.width <= 767) {
      expect(editMetrics.bottomNavDisplay).toBe('none');
      expect(Number.parseFloat(editMetrics.shellPaddingBottom)).toBeLessThanOrEqual(20);
    }

    const editSave = page.getByRole('button', { name: 'Salvar' });
    await editSave.scrollIntoViewIfNeeded();
    await expect(editSave).toBeVisible();
    const saveBox = await editSave.boundingBox();
    expect(saveBox).not.toBeNull();
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(viewport.height);
    const patch = page.waitForRequest(
      (request) => request.url().includes('/api/budgets/') && request.method() === 'PATCH',
    );
    await editSave.click();
    await patch;
    await expect(page.getByRole('heading', { name: 'Resumo' })).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/budgets');
  await page.getByRole('button', { name: 'Editar orçamento' }).click();
  await page.getByPlaceholder('5.000,00').fill('9.999,00');
  const keyboardSave = page.getByRole('button', { name: 'Salvar' });
  await keyboardSave.scrollIntoViewIfNeeded();
  await expect(keyboardSave).toBeVisible();
  const keyboardBox = await keyboardSave.boundingBox();
  expect(keyboardBox).not.toBeNull();
  expect(keyboardBox!.y + keyboardBox!.height).toBeLessThanOrEqual(480);

  await testInfo.attach('budgets-mobile-reproduction-metrics.json', {
    body: Buffer.from(JSON.stringify({ metrics, sentPayload }, null, 2)),
    contentType: 'application/json',
  });
});

test('dirty guard preserva valores e protege Voltar, Android Back e navegação de rota', async ({
  page,
}) => {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf-sintetico' } }),
  );
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/categories?*', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/budgets?*', (route) => route.fulfill({ json: projected }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/budgets');
  await page.getByRole('button', { name: 'Editar orçamento' }).click();

  const cleanBackPrevented = await page.evaluate(() => {
    const event = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(cleanBackPrevented).toBe(false);
  await page.getByPlaceholder('5.000,00').fill('7.777,00');
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByRole('dialog', { name: 'Descartar alterações?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.getByPlaceholder('5.000,00')).toHaveValue('7.777,00');

  const dirtyBackPrevented = await page.evaluate(() => {
    const event = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(dirtyBackPrevented).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Descartar alterações?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page.getByPlaceholder('5.000,00')).toHaveValue('7.777,00');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('link', { name: 'Início' }).click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(page.getByRole('dialog', { name: 'Descartar alterações?' })).toBeVisible();
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
