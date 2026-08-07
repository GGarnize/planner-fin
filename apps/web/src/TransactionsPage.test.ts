import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionsPage from './pages/TransactionsPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) } as Response);
const empty = { data: [], page: { limit: 20, nextCursor: null } };
describe('tela de lançamentos (API mockada)', () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  it('mostra vazio e criação de receita/despesa', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(path === '/transactions?' ? empty : []),
    );
    const w = mount(TransactionsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.text()).toContain('Nenhum lançamento cadastrado');
    expect(w.text()).toContain('Nova receita');
    expect(w.text()).toContain('Nova despesa');
  });
  it('envia valores monetários como strings ao criar pendente', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(path === '/transactions?' ? empty : []),
    );
    const w = mount(TransactionsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Nova despesa')!
      .trigger('click');
    const form = w.get('.modal form');
    await form.find('input[maxlength="200"]').setValue('Mercado');
    const inputs = form.findAll('input');
    await inputs.find((i) => i.attributes('inputmode') === 'decimal')!.setValue('10.25');
    await inputs.find((i) => i.attributes('type') === 'date')!.setValue('2026-08-08');
    await form.trigger('submit');
    await flushPromises();
    const call = vi.mocked(authenticatedFetch).mock.calls.find((c) => c[1]?.method === 'POST')!;
    expect(typeof JSON.parse(call[1]!.body as string).plannedAmount).toBe('string');
  });
  it('paga, reabre, filtra e pagina', async () => {
    const item = {
      id: '1',
      accountId: 'a',
      categoryId: 'c',
      type: 'EXPENSE',
      status: 'PENDING',
      description: 'Conta',
      notes: null,
      plannedAmount: '10.00',
      actualAmount: null,
      dueDate: '2026-08-01',
      paidAt: null,
      isOverdue: true,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(
        String(path).startsWith('/transactions?')
          ? { data: [item], page: { limit: 20, nextCursor: 'cursor' } }
          : [],
      ),
    );
    const w = mount(TransactionsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.text()).toContain('Vencido');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Marcar como pago')!
      .trigger('click');
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    expect(vi.mocked(authenticatedFetch).mock.calls.some((c) => c[0].endsWith('/pay'))).toBe(true);
    await w
      .findAll('button')
      .find((b) => b.text() === 'Carregar mais')!
      .trigger('click');
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some((c) => c[0].includes('cursor=cursor')),
    ).toBe(true);
  });
  it('informa API indisponível', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      String(path).startsWith('/transactions?')
        ? Promise.reject(new Error('offline'))
        : response([]),
    );
    const w = mount(TransactionsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.get('[role=alert]').text()).toContain('API indisponível');
  });
});
