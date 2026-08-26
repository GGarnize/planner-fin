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
    pendingNotificationReviews: 0,
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
    const eventSpy = vi.fn();
    window.addEventListener('plannerfin:new-transaction', eventSpy);
    await wrapper.get('.quick-actions .primary-action').trigger('click');
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('plannerfin:new-transaction', eventSpy);
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
    expect(wrapper.text()).toContain('Dezembro de 2026');
    expect(wrapper.get('.period-label').text()).not.toContain('Dez/2026');
    await wrapper.get('button[aria-label="Próximo mês"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Janeiro de 2027');
    await wrapper.get('button[aria-label="Mês anterior"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Dezembro de 2026');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Mês atual')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Dezembro de 2026');
  });
  it('abre seletor compacto, aplica mês e fecha pelo Back Android', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response(data));
    const wrapper = mount(DashboardPage, { global: { stubs: ['RouterLink'] } });
    await flushPromises();
    await wrapper.get('.period-label').trigger('click');
    expect(wrapper.find('#dashboard-period-picker').exists()).toBe(true);
    const back = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(back);
    await flushPromises();
    expect(back.defaultPrevented).toBe(true);
    expect(wrapper.find('#dashboard-period-picker').exists()).toBe(false);

    await wrapper.get('.period-label').trigger('click');
    await wrapper.get('input[type="month"]').setValue('2026-01');
    await wrapper.get('#dashboard-period-picker').trigger('submit');
    await flushPromises();
    expect(vi.mocked(authenticatedFetch).mock.calls.at(-1)![0]).toBe('/dashboard?month=2026-01');
    expect(wrapper.text()).toContain('Janeiro de 2026');
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
        {
          id: 't-income',
          type: 'INCOME',
          description: 'Salário',
          plannedAmount: '5000.00',
          dueDate: '2026-08-05',
          categoryName: 'Trabalho',
          overdue: false,
        },
      ],
      cardInvoices: [
        {
          invoiceId: 'i',
          cardId: 'c',
          cardName: 'Cartão teste',
          referenceMonth: '2026-08',
          status: 'OPEN',
          total: '200.00',
          dueDate: '2026-09-05',
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
        {
          debtId: 'd2',
          installmentId: 'di2',
          creditorName: 'Credor em dia',
          installmentNumber: 2,
          dueDate: '2026-08-05',
          totalAmount: '100.00',
          projectedStatus: 'PENDING',
          principalAmount: '100.00',
          interestAmount: '0.00',
          feeAmount: '0.00',
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
    for (const text of ['Aluguel', 'Salário', 'Cartão teste', 'Credor teste', 'Casa', 'R$ 25,00'])
      expect(wrapper.text()).toContain(text);
    expect(wrapper.text()).toContain('Despesa');
    expect(wrapper.text()).toContain('Receita');
    expect(wrapper.text()).toContain('Cartão teste · Ago/2026');
    expect(wrapper.text()).toContain('R$ 200,00 · Aberta · vence em 5 set');
    expect(wrapper.text()).toContain('R$ 300,00 · vence em 1 ago');
    expect(wrapper.text()).toContain('R$ 5.000,00 · vence em 5 ago');
    expect(wrapper.text()).toContain('R$ 425,00 · Vencida · vence em 1 ago');
    expect(wrapper.text()).toContain('R$ 100,00 · Pendente · vence em 5 ago');
    expect(wrapper.text()).not.toMatch(/\b(OPEN|CLOSED|INCOME|EXPENSE|OVERDUE|PENDING)\b/);
    expect(wrapper.text()).not.toContain('2026-08');
    expect(wrapper.text()).not.toContain('2026-09-05');
    expect(wrapper.text()).toContain('Resultado realizado');
    expect(wrapper.text()).not.toContain('Saldo realizado');
    expect(wrapper.get('a[href="/budgets"]').attributes('href')).toBe('/budgets');
  });
  it('mostra atalho Para revisar somente quando ha pendencias de notificacao', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(
      response({
        ...data,
        counters: { ...data.counters, pendingNotificationReviews: 3 },
      }),
    );
    const wrapper = mount(DashboardPage, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.get('a[href="/notifications/inbox"]').text()).toContain('Para revisar');
    expect(wrapper.get('a[href="/notifications/inbox"]').text()).toContain(
      '3 movimentações aguardando revisão',
    );

    vi.mocked(authenticatedFetch).mockReturnValue(response(data));
    const withoutPending = mount(DashboardPage, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    });
    await flushPromises();
    expect(withoutPending.find('a[href="/notifications/inbox"]').exists()).toBe(false);
    withoutPending.unmount();
  });
  it('mostra singular quando ha uma notificacao aguardando revisao', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(
      response({
        ...data,
        counters: { ...data.counters, pendingNotificationReviews: 1 },
      }),
    );
    const wrapper = mount(DashboardPage, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.get('a[href="/notifications/inbox"]').text()).toContain(
      '1 movimentação aguardando revisão',
    );
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
    await wrapper.get('button[aria-label="Próximo mês"]').trigger('click');
    expect(wrapper.text()).not.toContain('Nenhuma conta ativa');
    reject();
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('falha controlada');
    expect(wrapper.text()).not.toContain('R$ 0,00');
  });
  it('ignora resposta antiga quando uma carga de período mais recente termina antes', async () => {
    let releaseOld!: () => void;
    const oldResponse = new Promise<Response>((resolve) => {
      releaseOld = () =>
        resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ...data,
              cashPosition: {
                totalRealizedBalance: '10.00',
                availableAccountCount: 1,
                unavailableAccountCount: 0,
              },
            }),
        } as Response);
    });
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(data))
      .mockReturnValueOnce(oldResponse)
      .mockReturnValueOnce(
        response({
          ...data,
          cashPosition: {
            totalRealizedBalance: '20.00',
            availableAccountCount: 1,
            unavailableAccountCount: 0,
          },
        }),
      );
    const wrapper = mount(DashboardPage, { global: { stubs: ['RouterLink'] } });
    await flushPromises();
    await wrapper.get('button[aria-label="Próximo mês"]').trigger('click');
    await wrapper.get('button[aria-label="Próximo mês"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('R$ 20,00');
    releaseOld();
    await flushPromises();
    expect(wrapper.text()).toContain('R$ 20,00');
    expect(wrapper.text()).not.toContain('R$ 10,00');
  });
});
