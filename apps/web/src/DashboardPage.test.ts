import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './pages/DashboardPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const data = {
  month: '2026-08',
  generatedAt: '',
  cashPosition: {
    totalRealizedBalance: null,
    availableAccountCount: 2,
    unavailableAccountCount: 1,
  },
  monthlyFlow: {
    incomeRealized: '1950.00',
    incomePlanned: '3000.00',
    expenseRealized: '705.00',
    expenseCommitted: '1025.00',
    realizedNet: '1245.00',
    plannedNet: '1975.00',
  },
  budget: null,
  upcomingTransactions: [],
  cardInvoices: [],
  debtInstallments: [],
  expenseByCategory: { categories: [], uncategorizedDebtCostRealized: '25.00' },
  counters: {
    overdueTransactions: 0,
    upcomingTransactions: 0,
    unpaidCardInvoices: 0,
    overdueDebtInstallments: 0,
  },
};
const response = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
describe('DashboardPage', () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  it('não inventa caixa parcial e oferece os cinco destinos rápidos', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response(data));
    const wrapper = mount(DashboardPage, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Saldo total atual ainda não disponível');
    expect(wrapper.text()).not.toContain('R$ 1.500,00');
    expect(wrapper.text()).toContain('Resultado planejado/comprometido');
    expect(wrapper.findAll('.actions a')).toHaveLength(5);
  });
  it('permite tentar novamente após erro unitário', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response({}, false))
      .mockReturnValueOnce(response(data));
    const wrapper = mount(DashboardPage, { global: { stubs: ['RouterLink'] } });
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('Não foi possível');
    await wrapper.get('[role=alert] button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Posição atual');
  });
});
