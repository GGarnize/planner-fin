import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionTemplatesPage from './pages/TransactionTemplatesPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const ok = (data: unknown) => Promise.resolve({ ok: true, json: async () => data } as Response);
const category = { id: 'c', name: 'Moradia', type: 'EXPENSE', archivedAt: null };
const incomeCategory = { id: 'ci', name: 'Salário', type: 'INCOME', archivedAt: null };
const account = { id: 'a', name: 'Conta', archivedAt: null };
const template = {
  id: 't',
  name: 'Aluguel',
  type: 'EXPENSE',
  categoryId: 'c',
  categoryAvailable: true,
  description: 'Aluguel',
  plannedAmount: '100.00',
  defaultAccountId: 'a',
  defaultAccountAvailable: true,
  notes: null,
  dueDay: 10,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
};
describe('gestão de modelos', () => {
  beforeEach(() =>
    vi
      .mocked(authenticatedFetch)
      .mockImplementation((path) =>
        path === '/accounts'
          ? ok([account])
          : path === '/categories'
            ? ok([category, incomeCategory])
            : ok([template]),
      ),
  );
  it('lista ativos e oferece edição e arquivamento sem hard delete', async () => {
    const wrapper = mount(TransactionTemplatesPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(wrapper.text()).toContain('Aluguel');
    expect(wrapper.text()).toContain('Editar');
    expect(wrapper.text()).toContain('Arquivar');
    expect(wrapper.text()).not.toContain('Excluir');
  });
  it('arquiva e restaura pelos endpoints contratuais', async () => {
    const wrapper = mount(TransactionTemplatesPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('.danger').trigger('click');
    await wrapper.findAll('.danger').at(-1)!.trigger('click');
    await flushPromises();
    expect(
      vi
        .mocked(authenticatedFetch)
        .mock.calls.some(
          ([path, init]) => path === '/transaction-templates/t/archive' && init?.method === 'POST',
        ),
    ).toBe(true);
  });
  it('limpa a categoria incompatível ao mudar a natureza do modelo', async () => {
    const wrapper = mount(TransactionTemplatesPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('.secondary').trigger('click');
    const dialog = wrapper.get('form[role="dialog"]');
    await dialog.get('select').setValue('INCOME');
    expect((dialog.findAll('select')[1]!.element as HTMLSelectElement).value).toBe('');
  });
  it('fecha a confirmação com Escape e com Back Android', async () => {
    const wrapper = mount(TransactionTemplatesPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('.danger').trigger('click');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.confirm').exists()).toBe(false);
    await wrapper.get('.danger').trigger('click');
    const back = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(back);
    await wrapper.vm.$nextTick();
    expect(back.defaultPrevented).toBe(true);
    expect(wrapper.find('.confirm').exists()).toBe(false);
  });
  it('pede confirmacao no Back Android antes de descartar modelo sujo', async () => {
    const wrapper = mount(TransactionTemplatesPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('.secondary').trigger('click');
    const name = wrapper.get('input[maxlength="120"]');
    await name.setValue('Modelo em edicao');
    const back = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(back);
    await wrapper.vm.$nextTick();
    expect(back.defaultPrevented).toBe(true);
    expect(wrapper.find('.confirm').text()).toContain('Descartar rascunho');
    await wrapper.get('.confirm .secondary').trigger('click');
    expect(wrapper.find('.confirm').exists()).toBe(false);
    expect((name.element as HTMLInputElement).value).toBe('Modelo em edicao');
  });
});
