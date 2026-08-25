import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import AuthenticatedShell from './components/AuthenticatedShell.vue';

const mountShell = async (path = '/dashboard') => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', component: { template: '<p>Dashboard</p>' } },
      { path: '/transactions', component: { template: '<p>Lançamentos</p>' } },
      { path: '/budgets', component: { template: '<p>Orçamento</p>' } },
      { path: '/mais', component: { template: '<p>Mais</p>' } },
      { path: '/accounts', component: { template: '<p>Contas</p>' } },
      { path: '/notifications/inbox', component: { template: '<p>Inbox</p>' } },
    ],
  });
  await router.push(path);
  await router.isReady();
  return { wrapper: mount(AuthenticatedShell, { global: { plugins: [router] } }), router };
};

describe('AuthenticatedShell', () => {
  it('oferece quatro destinos com ícone, rótulo e estado ativo', async () => {
    const { wrapper } = await mountShell();
    const links = wrapper.findAll('.bottom-nav a');
    expect(links.map((link) => link.text())).toEqual([
      'homeInício',
      'receipt_longLançamentos',
      'account_balance_walletOrçamento',
      'more_horizMais',
    ]);
    expect(links[0]!.attributes('aria-current')).toBe('page');
    expect(wrapper.get('.global-fab').attributes('aria-label')).toBe('Novo lançamento');
  });

  it('considera módulo secundário ativo em Mais sem exibir FAB global', async () => {
    const { wrapper, router } = await mountShell('/accounts');
    expect(wrapper.findAll('.bottom-nav a')[3]!.attributes('aria-current')).toBe('page');
    expect(wrapper.find('.global-fab').exists()).toBe(false);
    await router.push('/notifications/inbox');
    await flushPromises();
    expect(wrapper.findAll('.bottom-nav a')[3]!.attributes('aria-current')).toBe('page');
    expect(wrapper.find('.global-fab').exists()).toBe(false);
  });

  it('fecha a escolha global por Escape e pelo Back Android antes de navegar', async () => {
    const { wrapper } = await mountShell();
    await wrapper.get('.global-fab').trigger('click');
    expect(wrapper.find('[role=dialog]').exists()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('[role=dialog]').exists()).toBe(false);

    await wrapper.get('.global-fab').trigger('click');
    const back = new Event('plannerfin:android-back', { cancelable: true });
    const notCancelled = window.dispatchEvent(back);
    await flushPromises();
    expect(notCancelled).toBe(false);
    expect(wrapper.find('[role=dialog]').exists()).toBe(false);
  });

  it('desabilita o FAB e impede empilhar o chooser global', async () => {
    const { wrapper } = await mountShell();
    await wrapper.get('.global-fab').trigger('click');
    expect(wrapper.findAll('[role=dialog]')).toHaveLength(1);
    expect(wrapper.get('.global-fab').attributes('aria-disabled')).toBe('true');
    expect(wrapper.get('.global-fab').attributes('tabindex')).toBe('-1');
    await wrapper.get('.global-fab').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[role=dialog]')).toHaveLength(1);
  });
});
