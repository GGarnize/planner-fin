import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => vi.useRealTimers());
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
    expect(wrapper.get('.quick-actions a[href="/transfers"]').text()).toBe('Transferir');
    expect(wrapper.get('.quick-actions .primary-action').text()).toBe('+ Novo lançamento');
    expect(
      wrapper
        .find('.position-panel')
        .element.compareDocumentPosition(wrapper.find('.summary-panel').element),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
  it('usa o mês civil local, navega na virada do ano e retorna ao mês atual', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T23:30:00.000Z'));
    vi.mocked(authenticatedFetch).mockReturnValue(response(data));
    const wrapper = mount(DashboardPage, { global: { stubs: ['RouterLink'] } });
    await flushPromises();
    expect(wrapper.text()).toContain('2026-12');
    const buttons = wrapper.findAll('header button');
    await buttons[2]!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('2027-01');
    await buttons[0]!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('2026-12');
    await buttons[1]!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('2026-12');
  });
  it('renderiza caixa, orçamento excedido, listas, categorias e terminologia financeira', async () => {
    const complete = {
      ...data,
      cashPosition: {
        totalRealizedBalance: '1500.00',
        availableAccountCount: 2,
        unavailableAccountCount: 0,
      },
      budget: {
        id: 'budget',
        totalLimit: '1000.00',
        realizedExpense: '705.00',
        committedExpense: '1025.00',
        remainingAgainstRealized: '295.00',
        remainingAgainstCommitted: '-25.00',
        realizedPercent: '70.50',
        committedPercent: '102.50',
        exceeded: true,
      },
      upcomingTransactions: [
        {
          id: 't',
          type: 'EXPENSE',
          description: 'Aluguel',
          plannedAmount: '300.00',
          dueDate: '2026-08-01',
          categoryName: 'Casa',
          overdue: true,
        },
      ],
      cardInvoices: [
        {
          invoiceId: 'i',
          cardId: 'c',
          cardName: 'Cartão teste',
          referenceMonth: '2026-08',
          status: 'CLOSED',
          total: '200.00',
          dueDate: '2026-08-01',
          projectedOverdue: true,
        },
      ],
      debtInstallments: [
        {
          debtId: 'd',
          installmentId: 'di',
          creditorName: 'Credor teste',
          installmentNumber: 1,
          dueDate: '2026-08-01',
          totalAmount: '425.00',
          projectedStatus: 'OVERDUE',
          principalAmount: '400.00',
          interestAmount: '20.00',
          feeAmount: '5.00',
        },
      ],
      expenseByCategory: {
        categories: [{ categoryId: 'c', categoryName: 'Casa', amount: '480.00' }],
        uncategorizedDebtCostRealized: '25.00',
      },
    };
    vi.mocked(authenticatedFetch).mockReturnValue(response(complete));
    const wrapper = mount(DashboardPage, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('R$ 1.500,00');
    expect(wrapper.find('.exceeded').exists()).toBe(true);
    for (const text of ['Aluguel', 'Cartão teste', 'Credor teste', 'Casa', 'R$ 25,00'])
      expect(wrapper.text()).toContain(text);
    expect(wrapper.text()).toContain('Resultado realizado');
    expect(wrapper.text()).not.toContain('Saldo realizado');
    expect(wrapper.get('a[href="/budgets"]').attributes('href')).toBe('/budgets');
  });
  it('mostra ausência de contas e limpa o snapshot anterior durante nova carga com erro', async () => {
    let reject!: () => void;
    const pending = new Promise<Response>((_, failure) => {
      reject = () => failure(new Error('falha controlada'));
    });
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(
        response({
          ...data,
          cashPosition: {
            totalRealizedBalance: '0.00',
            availableAccountCount: 0,
            unavailableAccountCount: 0,
          },
        }),
      )
      .mockReturnValueOnce(pending);
    const wrapper = mount(DashboardPage, { global: { stubs: ['RouterLink'] } });
    await flushPromises();
    expect(wrapper.text()).toContain('Nenhuma conta ativa');
    await wrapper.findAll('header button')[2]!.trigger('click');
    expect(wrapper.text()).not.toContain('Nenhuma conta ativa');
    reject();
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('falha controlada');
    expect(wrapper.text()).not.toContain('R$ 0,00');
  });
});
