import { expect, test } from '@playwright/test';

test('página inicial técnica abre', async ({ page }) => {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({ json: { status: 'ok', service: 'planner-fin-api' } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PlannerFin' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API disponível');
});
