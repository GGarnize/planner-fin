import { expect, test } from '@playwright/test';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Pessoa Teste',
  email: 'pessoa@example.test',
  createdAt: '2026-08-06T12:00:00.000Z',
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'INVALID_SESSION', message: 'Sessão inválida.' } },
    }),
  );
});
test('cadastro abre rota protegida e logout bloqueia acesso', async ({ page }) => {
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({ status: 201, json: { accessToken: 'token-sintetico', expiresIn: 900, user } }),
  );
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 204 }));
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill(user.name);
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill('SenhaTeste123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/conta');
  await expect(page).toHaveURL(/\/login/);
});
test('login inválido usa mensagem genérica', async ({ page }) => {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } },
    }),
  );
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill('SenhaErrada123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
});
