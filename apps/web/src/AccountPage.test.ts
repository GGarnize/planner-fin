import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AccountPage from './pages/AccountPage.vue';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  logout: vi.fn(),
  saveVisualPreferences: vi.fn(),
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
  authenticatedFetch: vi.fn(),
  logout: mocks.logout,
}));
vi.mock('./appearance', () => ({
  APPEARANCES: [
    { value: 'SYSTEM', label: 'Sistema', description: 'Acompanha o dispositivo.' },
    { value: 'LIGHT', label: 'Claro', description: 'Tema claro.' },
    { value: 'DARK', label: 'Escuro', description: 'Tema escuro.' },
  ],
  ACCENTS: [
    { value: 'BLUE', label: 'Azul' },
    { value: 'TEAL', label: 'Verde-azulado' },
    { value: 'PURPLE', label: 'Violeta' },
    { value: 'ORANGE', label: 'Laranja' },
  ],
  appearanceState: {
    current: { appearance: 'SYSTEM', accent: 'BLUE' },
    saving: false,
    error: '',
    savedMessage: '',
  },
  saveVisualPreferences: mocks.saveVisualPreferences,
}));

describe('AccountPage', () => {
  it('renderiza dados compactos, atalhos e saída separada', async () => {
    const wrapper = mount(AccountPage, { global: { stubs: { RouterLink: RouterLinkStub } } });

    expect(wrapper.get('h1').text()).toBe('Minha conta');
    expect(wrapper.text()).toContain('Pessoa Teste');
    expect(wrapper.text()).toContain('pessoa@example.test');
    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      '/mais',
      '/accounts',
      '/categories',
    ]);
    expect(wrapper.text()).toContain('Aparencia');
    expect(wrapper.findAll('.appearance-panel button')).toHaveLength(7);
    await wrapper.get('[aria-label="Cor de destaque Verde-azulado"]').trigger('click');
    expect(mocks.saveVisualPreferences).toHaveBeenCalledWith(
      { accent: 'TEAL' },
      expect.any(Function),
    );
    expect(wrapper.get('.danger-zone').text()).toContain('Sair');

    await wrapper.get('.danger-zone button').trigger('click');
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/login');
  });
});
