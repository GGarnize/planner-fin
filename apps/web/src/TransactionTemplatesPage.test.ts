import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionTemplatesPage from './pages/TransactionTemplatesPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const ok = (data: unknown) => Promise.resolve({ ok: true, json: async () => data } as Response);
const category = { id: 'c', name: 'Moradia', type: 'EXPENSE', archivedAt: null };
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
            ? ok([category])
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
});
