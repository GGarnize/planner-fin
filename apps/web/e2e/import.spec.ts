import { expect, test } from '@playwright/test';

const user = { id: 'u', name: 'Pessoa Teste', email: 'importacao@example.test', createdAt: '' };
const account = { id: 'a', name: 'Conta sintética', currency: 'BRL', archivedAt: null };
const categories = [
  { id: 'ci', name: 'Receitas sintéticas', type: 'INCOME', archivedAt: null },
  { id: 'ce', name: 'Despesas sintéticas', type: 'EXPENSE', archivedAt: null },
];
const rows = [
  {
    id: 'r1',
    rowNumber: 1,
    date: '2026-08-01',
    description: 'entrada sintética',
    type: 'INCOME',
    amount: '100.00',
    categoryId: 'ci',
    selected: true,
    validationStatus: 'VALID',
    warnings: [],
    duplicateClassification: 'NONE',
    probableOverride: false,
    possibleAccepted: false,
  },
  {
    id: 'r2',
    rowNumber: 2,
    date: '2026-08-02',
    description: 'despesa sintética',
    type: 'EXPENSE',
    amount: '25.00',
    categoryId: 'ce',
    selected: true,
    validationStatus: 'VALID',
    warnings: [],
    duplicateClassification: 'NONE',
    probableOverride: false,
    possibleAccepted: false,
  },
];
const sample = {
  columns: [
    { index: 0, header: 'Data', samples: ['01/08/2026', '02/08/2026'] },
    { index: 1, header: 'Descrição', samples: ['entrada sintética', 'despesa sintética'] },
    { index: 2, header: 'Valor', samples: ['100', '’-25'] },
  ],
  rowCount: 2,
};
const session = (status: string, currentRows = rows) => ({
  id: '11111111-1111-4111-8111-111111111111',
  accountId: 'a',
  format: 'CSV',
  status,
  draftVersion: status === 'MAPPING_REQUIRED' ? 1 : 2,
  displayFileName: 'extrato-sintetico.csv',
  rowCount: 2,
  expiresAt: '2099-08-20T00:00:00Z',
  mapping: null,
  ...(status === 'MAPPING_REQUIRED' ? { csvSample: sample } : {}),
  rows: currentRows,
  page: { limit: 100, offset: 0, filteredCount: currentRows.length },
});

test('CSV sintético passa por mapping, revisão, preview e confirmação', async ({
  page,
}, testInfo) => {
  let state = session('MAPPING_REQUIRED', []);
  let confirmed = false;
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: { csrfToken: 'csrf' } }));
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token', csrfToken: 'csrf', expiresIn: 900, user } }),
  );
  await page.route('**/api/accounts', (route) => route.fulfill({ json: [account] }));
  await page.route('**/api/categories', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/imports', async (route) => {
    if (route.request().method() === 'GET') await route.fulfill({ json: [] });
    else {
      state = session('MAPPING_REQUIRED', []);
      await route.fulfill({ json: state });
    }
  });
  await page.route('**/api/imports/*/mapping', async (route) => {
    state = session('READY_FOR_REVIEW');
    await route.fulfill({ json: state });
  });
  await page.route('**/api/imports/*/preview', (route) =>
    route.fulfill({
      json: {
        previewToken: 'preview',
        previewHash: 'hash',
        draftVersion: 2,
        counts: { total: 2, selected: 2, blocked: 0, strong: 0, probable: 0, possible: 0 },
        totals: { income: '100.00', expense: '25.00' },
      },
    }),
  );
  await page.route('**/api/imports/*/confirm', async (route) => {
    confirmed = true;
    await route.fulfill({
      json: {
        status: 'CONFIRMED',
        sessionId: state.id,
        transactionIds: ['t1', 't2'],
        createdCount: 2,
      },
    });
  });
  await page.route('**/api/imports/*?*', (route) => route.fulfill({ json: state }));
  await page.route('**/api/transactions?*', (route) =>
    route.fulfill({
      json: {
        data: confirmed
          ? rows.map((row) => ({
              ...row,
              accountId: 'a',
              plannedAmount: row.amount,
              actualAmount: row.amount,
              status: 'PAID',
              dueDate: row.date,
              paidAt: row.date,
              notes: null,
              isOverdue: false,
              isRecurringOccurrence: false,
              createdAt: '',
              updatedAt: '',
            }))
          : [],
        page: { limit: 20, nextCursor: null },
      },
    }),
  );

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/mais');
  await page.getByRole('link', { name: /Importar extrato/ }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'extrato-sintetico.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('data,descricao,valor\n01/08/2026,entrada,100\n02/08/2026,despesa,-25'),
  });
  await page.getByRole('button', { name: 'Enviar arquivo' }).click();
  await expect(
    page.getByRole('option', { name: /Data — ex.: 01\/08\/2026/ }).first(),
  ).toBeAttached();
  await page.getByRole('button', { name: /Aplicar mapping/ }).click();
  await expect(page.getByText('entrada sintética')).toBeVisible();
  await page.getByRole('button', { name: 'Revisar resumo' }).click();
  await page.getByRole('button', { name: 'Importar 2 lançamentos' }).click();
  await expect(page.getByRole('heading', { name: 'Importação concluída' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('importacao-concluida-mobile.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Ver lançamentos' }).click();
  await expect(page.getByText('entrada sintética')).toBeVisible();
});

test('draft reaparece em /imports e só é retomado ao escolher Continuar', async ({ page }) => {
  const draft = {
    id: session('MAPPING_REQUIRED').id,
    accountId: 'a',
    format: 'CSV',
    status: 'MAPPING_REQUIRED',
    displayFileName: 'extrato-agosto.csv',
    draftVersion: 1,
    updatedAt: new Date().toISOString(),
    expiresAt: '2099-08-20T00:00:00Z',
  };
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ json: { csrfToken: 'csrf' } }));
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ json: { accessToken: 'token', csrfToken: 'csrf', expiresIn: 900, user } }),
  );
  await page.route('**/api/accounts', (route) => route.fulfill({ json: [account] }));
  await page.route('**/api/categories', (route) => route.fulfill({ json: categories }));
  await page.route('**/api/imports?status=open', (route) => route.fulfill({ json: [draft] }));
  await page.route('**/api/imports/*?*', (route) =>
    route.fulfill({ json: session('MAPPING_REQUIRED', []) }),
  );

  await page.goto('/imports');
  await expect(page.getByText('extrato-agosto.csv')).toBeVisible();
  await expect(page.getByText('Nova importação')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/imports\/11111111/);
  await expect(page.getByRole('heading', { name: '2. Mapear CSV' })).toBeVisible();
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
});
