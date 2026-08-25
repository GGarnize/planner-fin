import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  authState: { token: null as string | null, user: null, restoring: false, error: '' },
  restore: vi.fn(async () => undefined),
}));
vi.mock('./auth', () => mocked);

import MorePage from './pages/MorePage.vue';
import { router } from './router';

describe('redirecionamentos de autenticação', () => {
  it('permite abrir a Política de Privacidade sem autenticação', async () => {
    mocked.authState.token = null;
    await router.push('/privacy-policy');
    await router.isReady();
    expect(router.currentRoute.value.fullPath).toBe('/privacy-policy');
  });

  it('permite abrir a Política de Privacidade com autenticação', async () => {
    mocked.authState.token = 'token';
    await router.push('/privacy-policy');
    expect(router.currentRoute.value.fullPath).toBe('/privacy-policy');
  });

  it('mantém login e cadastro como guest-only', async () => {
    mocked.authState.token = 'token';
    await router.push('/login');
    expect(router.currentRoute.value.fullPath).toBe('/dashboard');

    await router.push('/cadastro');
    expect(router.currentRoute.value.fullPath).toBe('/dashboard');
  });

  it('permite abrir a Política de Privacidade pelo Mais autenticado', async () => {
    mocked.authState.token = 'token';
    await router.push('/mais');
    const wrapper = mount(MorePage, {
      global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } },
    });

    const privacyLink = wrapper
      .findAllComponents(RouterLinkStub)
      .find((candidate) => candidate.props('to') === '/privacy-policy');
    expect(privacyLink).toBeTruthy();
    await router.push(privacyLink!.props('to'));

    expect(router.currentRoute.value.fullPath).toBe('/privacy-policy');
  });

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

  it('mantem rota diagnostica protegida por auth', async () => {
    mocked.authState.token = null;
    await router.push('/dev/notification-listener');
    expect(router.currentRoute.value.fullPath).toBe(
      '/login?redirect=/dev/notification-listener',
    );
  });

  it('protege a rota de captura por notificacoes e o inbox por auth', async () => {
    mocked.authState.token = null;
    await router.push('/notifications');
    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/notifications');
    await router.push('/notifications/inbox');
    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/notifications/inbox');
  });
});
