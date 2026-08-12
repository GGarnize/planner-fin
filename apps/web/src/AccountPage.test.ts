import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AccountPage from './pages/AccountPage.vue';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return { ...actual, useRouter: () => ({ push: mocks.push }) };
});
vi.mock('./auth', () => ({
  authState: {
    user: {
      id: 'user-1',
      name: 'Pessoa Teste',
      email: 'pessoa@example.test',
      createdAt: '2026-08-12T12:00:00.000Z',
    },
    error: '',
  },
  logout: mocks.logout,
}));

describe('AccountPage', () => {
  it('renderiza dados compactos, atalhos e saída separada', async () => {
    const wrapper = mount(AccountPage, { global: { stubs: { RouterLink: RouterLinkStub } } });

    expect(wrapper.get('h1').text()).toBe('Minha conta');
    expect(wrapper.text()).toContain('Pessoa Teste');
    expect(wrapper.text()).toContain('pessoa@example.test');
    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      '/accounts',
      '/categories',
    ]);
    expect(wrapper.get('.danger-zone').text()).toContain('Sair');

    await wrapper.get('.danger-zone button').trigger('click');
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/login');
  });
});
