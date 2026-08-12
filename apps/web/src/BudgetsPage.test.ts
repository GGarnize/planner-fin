import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BudgetsPage from './pages/BudgetsPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const response = (data: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) } as Response);
const projected = {
  id: '00000000-0000-4000-8000-000000000010',
  month: '2026-08',
  totalLimit: '100.00',
  notes: null,
  totals: {
    realizedExpense: '120.00',
    committedExpense: '130.00',
    remainingAgainstRealized: '-20.00',
    remainingAgainstCommitted: '-30.00',
    realizedPercent: '120.00',
    committedPercent: '130.00',
    unbudgetedRealizedExpense: '120.00',
    unbudgetedCommittedExpense: '130.00',
    uncategorizedDebtCostRealized: '0.00',
    uncategorizedDebtCostCommitted: '0.00',
  },
  categories: [],
  createdAt: '',
  updatedAt: '',
};
describe('tela de orçamento mensal', () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.TZ;
  });
  it('usa o mês civil local quando o UTC já avançou', async () => {
    process.env.TZ = 'America/Los_Angeles';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:30:00.000Z'));
    vi.mocked(authenticatedFetch).mockReturnValue(response({ error: {} }, 404));

    mount(BudgetsPage);
    await flushPromises();

    expect(vi.mocked(authenticatedFetch).mock.calls[1]![0]).toBe('/budgets?month=2026-08');
  });
  it('diferencia mês sem orçamento de falha de rede e permite criar sem categorias', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response([]))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = mount(BudgetsPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Nenhum orçamento para este mês');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Criar orçamento')!
      .trigger('click');
    await wrapper.get('input[placeholder="5000.00"]').setValue('5000.00');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(response(projected, 201));
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(
      JSON.parse(vi.mocked(authenticatedFetch).mock.calls.at(-1)![1]!.body as string),
    ).toMatchObject({
      categories: [],
      notes: null,
    });
  });
  it('mostra valores negativos, percentual acima de 100 e campos explicativos vindos da API', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response([]))
      .mockReturnValueOnce(response(projected));
    const wrapper = mount(BudgetsPage);
    await flushPromises();
    expect(wrapper.text()).toContain('130.00%');
    expect(wrapper.text()).toContain('-R$ 30,00');
    expect(wrapper.text()).toContain('Sem limite específico');
    expect(wrapper.text()).toContain('Custos de dívida não categorizados');
    expect(wrapper.text().toLowerCase()).not.toContain('saldo');
  });
  it('navega mês a mês usando uma consulta exata', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response({ error: {} }, 404));
    const wrapper = mount(BudgetsPage);
    await flushPromises();
    await wrapper.get('button[aria-label="Próximo mês"]').trigger('click');
    await flushPromises();
    expect(vi.mocked(authenticatedFetch).mock.calls.at(-1)![0]).toMatch(
      /^\/budgets\?month=\d{4}-\d{2}$/,
    );
  });
  it('apresenta falha recuperável em vez de estado vazio', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response([]))
      .mockRejectedValueOnce(new Error('offline'));
    const wrapper = mount(BudgetsPage);
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('API indisponível');
    expect(wrapper.text()).not.toContain('Nenhum orçamento para este mês');
  });
});
