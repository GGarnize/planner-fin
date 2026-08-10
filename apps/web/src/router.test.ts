import { describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({
  authState: { token: null as string | null, user: null, restoring: false, error: '' },
  restore: vi.fn(async () => undefined),
}));
vi.mock('./auth', () => mocked);

import { router } from './router';

describe('redirecionamentos de autenticação', () => {
  it('preserva deep-link no login e não força rotas autenticadas ao dashboard', async () => {
    mocked.authState.token = null;
    await router.push('/dashboard');
    await router.isReady();
    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/dashboard');

    mocked.authState.token = 'token';
    await router.push('/login');
    expect(router.currentRoute.value.fullPath).toBe('/dashboard');
    await router.push('/debts');
    expect(router.currentRoute.value.fullPath).toBe('/debts');
  });
});
