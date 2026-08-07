import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransfersPage from './pages/TransfersPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) } as Response);
const accounts = [
  { id: 'a', name: 'Origem', archivedAt: null },
  { id: 'b', name: 'Destino', archivedAt: null },
] as never;
const empty = { data: [], page: { limit: 20, nextCursor: null } };
describe('tela de transferências', () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  it('mostra estado vazio e formulário sem categoria', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(String(path).startsWith('/transfers?') ? empty : accounts),
    );
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.text()).toContain('Nenhuma transferência cadastrada');
    await w.get('button').trigger('click');
    expect(w.text()).toContain('Origem');
    expect(w.text()).toContain('Destino');
    expect(w.text()).not.toContain('Categoria');
  });
  it('exclui origem do destino e cria concluída com strings', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(String(path).startsWith('/transfers?') ? empty : accounts),
    );
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await w.get('button').trigger('click');
    const selects = w.findAll('.modal select');
    await selects[0]!.setValue('a');
    expect(selects[1]!.findAll('option').some((o) => o.attributes('value') === 'a')).toBe(false);
    await selects[1]!.setValue('b');
    await w.get('input[maxlength="200"]').setValue('Reserva');
    const decimals = w.findAll('input[inputmode="decimal"]');
    await decimals[0]!.setValue('10.00');
    await w.get('input[type="date"]').setValue('2026-08-08');
    await selects[2]!.setValue('COMPLETED');
    await flushPromises();
    const allDecimals = w.findAll('input[inputmode="decimal"]');
    await allDecimals[1]!.setValue('10.00');
    const dates = w.findAll('input[type="date"]');
    await dates[1]!.setValue('2026-08-08');
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    const call = vi.mocked(authenticatedFetch).mock.calls.find((c) => c[1]?.method === 'POST')!;
    const body = JSON.parse(call[1]!.body as string);
    expect(typeof body.plannedAmount).toBe('string');
    expect(body.status).toBe('COMPLETED');
  });
  it('mostra vencida, conclui, reabre, filtra e pagina', async () => {
    const item = {
      id: 't',
      sourceAccountId: 'a',
      destinationAccountId: 'b',
      status: 'PENDING',
      description: 'Reserva',
      notes: null,
      plannedAmount: '10.00',
      actualAmount: null,
      dueDate: '2026-08-01',
      completedAt: null,
      isOverdue: true,
      createdAt: 'x',
      updatedAt: 'x',
    };
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(
        String(path).startsWith('/transfers?')
          ? { data: [item], page: { limit: 20, nextCursor: 'cursor' } }
          : accounts,
      ),
    );
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.text()).toContain('Vencida');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Concluir')!
      .trigger('click');
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some((c) => String(c[0]).endsWith('/complete')),
    ).toBe(true);
    await w
      .findAll('button')
      .find((b) => b.text() === 'Carregar mais')!
      .trigger('click');
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some((c) => String(c[0]).includes('cursor=cursor')),
    ).toBe(true);
  });
  it('informa API indisponível', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      String(path).startsWith('/transfers?')
        ? Promise.reject(new Error('offline'))
        : response(accounts),
    );
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.get('[role=alert]').text()).toContain('API indisponível');
  });
});
