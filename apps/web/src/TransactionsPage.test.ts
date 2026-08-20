import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { routeLocationKey, routerKey } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicFinancialEntry, PublicFinancialTransaction } from '@planner-fin/shared';
import TransactionsPage from './pages/TransactionsPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';

const accountId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const txId = '44444444-4444-4444-8444-444444444444';
const cardId = '77777777-7777-4777-8777-777777777777';
const purchaseId = '88888888-8888-4888-8888-888888888888';

const response = (data: unknown, ok = true, status = ok ? 200 : 400) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(data) } as Response);
const empty = { data: [], page: { limit: 20, nextCursor: null } };
const account = { id: accountId, name: 'Banco', archivedAt: null };
const expenseCategory = { id: categoryId, name: 'Moradia', type: 'EXPENSE', archivedAt: null };
const incomeCategory = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Salário',
  type: 'INCOME',
  archivedAt: null,
};

function makeTx(
  overrides: Partial<{
    id: string;
    status: 'PENDING' | 'PAID';
    description: string;
    dueDate: string;
    plannedAmount: string;
    actualAmount: string | null;
    paidAt: string | null;
    isOverdue: boolean;
    isRecurringOccurrence: boolean;
    notes: string | null;
  }> = {},
) {
  const base = {
    id: txId,
    status: 'PENDING' as const,
    description: 'Conta',
    dueDate: '2026-08-01',
    plannedAmount: '10.00',
    actualAmount: null as string | null,
    paidAt: null as string | null,
    isOverdue: true,
    isRecurringOccurrence: false,
    notes: null as string | null,
    ...overrides,
  };
  const full: PublicFinancialTransaction = {
    id: base.id,
    accountId,
    categoryId,
    type: 'EXPENSE',
    status: base.status,
    description: base.description,
    notes: base.notes,
    plannedAmount: base.plannedAmount,
    actualAmount: base.actualAmount,
    dueDate: base.dueDate,
    paidAt: base.paidAt,
    isOverdue: base.isOverdue,
    isRecurringOccurrence: base.isRecurringOccurrence,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };
  const entry: PublicFinancialEntry = {
    id: `TRANSACTION:${base.id}`,
    source: 'TRANSACTION',
    sourceId: base.id,
    type: 'EXPENSE',
    description: base.description,
    notes: base.notes,
    date: base.dueDate,
    amount: base.status === 'PAID' ? base.actualAmount! : base.plannedAmount,
    categoryId,
    status: base.status,
    accountId,
    cardId: null,
    cardName: null,
    purchaseId: null,
    installmentNumber: null,
    installmentCount: null,
    overdue: base.isOverdue,
    isRecurringOccurrence: base.isRecurringOccurrence,
    createdAt: '2026-08-01T00:00:00Z',
  };
  return { entry, full };
}

function makeCardEntry(
  overrides: Partial<{
    installmentCount: number;
    date: string;
    amount: string;
  }> = {},
): PublicFinancialEntry {
  const installmentCount = overrides.installmentCount ?? 1;
  return {
    id: `CARD_PURCHASE:${purchaseId}`,
    source: 'CARD_PURCHASE',
    sourceId: purchaseId,
    type: 'EXPENSE',
    description: 'Abastecimento',
    notes: null,
    date: overrides.date ?? '2026-08-05',
    amount: overrides.amount ?? '150.00',
    categoryId,
    status: null,
    accountId: null,
    cardId,
    cardName: 'Nubank',
    purchaseId,
    installmentNumber: null,
    installmentCount,
    overdue: false,
    isRecurringOccurrence: false,
    createdAt: '2026-08-05T00:00:00Z',
  };
}

function mockPage(
  entriesResponse: unknown = empty,
  fulls: PublicFinancialTransaction[] = [],
  extra: (path: string, init?: RequestInit) => Promise<Response> | undefined = () => undefined,
) {
  vi.mocked(authenticatedFetch).mockImplementation((path, init) => {
    const p = String(path);
    const extraResult = extra(p, init);
    if (extraResult) return extraResult;
    if (p.startsWith('/financial-entries?')) return response(entriesResponse);
    if (p === '/accounts') return response([account]);
    if (p === '/categories') return response([expenseCategory, incomeCategory]);
    const full = fulls.find((f) => p === `/transactions/${f.id}`);
    if (full) return response(full);
    return response({});
  });
}
async function mountPage() {
  const wrapper = mount(TransactionsPage, { global: { stubs: ['router-link'] } });
  await flushPromises();
  return wrapper;
}
async function mountPageWithRoute(query: Record<string, unknown>) {
  const route = reactive({ query });
  const router = { replace: vi.fn() };
  const wrapper = mount(TransactionsPage, {
    global: {
      provide: {
        [routeLocationKey as symbol]: route,
        [routerKey as symbol]: router,
      },
      stubs: ['router-link'],
    },
  });
  await flushPromises();
  return { wrapper, route, router };
}
async function mountPageWithFullRouter(query: Record<string, unknown> = {}) {
  const route = reactive({ query });
  const router = { push: vi.fn(), replace: vi.fn() };
  const wrapper = mount(TransactionsPage, {
    global: {
      provide: {
        [routeLocationKey as symbol]: route,
        [routerKey as symbol]: router,
      },
      stubs: ['router-link'],
    },
  });
  await flushPromises();
  return { wrapper, route, router };
}
async function openAction(wrapper: VueWrapper, label: string, cardIndex = 0) {
  const triggers = wrapper.findAll('.kebab-trigger');
  await triggers[cardIndex]!.trigger('click');
  const buttons = wrapper.findAll('.kebab-panel button');
  await buttons.find((button) => button.text() === label)!.trigger('click');
}
async function openExpenseForm(wrapper: VueWrapper) {
  const form = wrapper.get('.modal form');
  await form.find('select').setValue('EXPENSE');
  const selects = form.findAll('select');
  await selects[1]!.setValue(accountId);
  await selects[2]!.setValue(categoryId);
  await form.find('input[maxlength="200"]').setValue('Aluguel');
  const inputs = form.findAll('input');
  await inputs.find((input) => input.attributes('inputmode') === 'decimal')!.setValue('1800');
  await inputs.find((input) => input.attributes('type') === 'date')!.setValue('2026-08-10');
  return form;
}
function submittedBody(method = 'POST') {
  const call = vi
    .mocked(authenticatedFetch)
    .mock.calls.find((entry) => entry[1]?.method === method)!;
  return JSON.parse(call[1]!.body as string) as Record<string, unknown>;
}

describe('tela de lançamentos (API mockada)', () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00-03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('carrega por default o mes civil atual por vencimento', async () => {
    mockPage();
    await mountPage();
    const firstListCall = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(([path]) => String(path).startsWith('/financial-entries?'))!;
    expect(String(firstListCall[0])).toContain('dueDateFrom=2026-08-01');
    expect(String(firstListCall[0])).toContain('dueDateTo=2026-08-31');
  });

  it('agrupa visualmente por hoje, futuros e anteriores sem considerar status', async () => {
    const { entry: todayPaid } = makeTx({
      id: '55555555-5555-4555-8555-555555555555',
      status: 'PAID',
      actualAmount: '10.00',
      dueDate: '2026-08-12',
      paidAt: '2026-08-12',
      isOverdue: false,
    });
    const { entry: future } = makeTx({
      id: '66666666-6666-4666-8666-666666666666',
      description: 'Futuro',
      dueDate: '2026-08-20',
      isOverdue: false,
    });
    const { entry: past } = makeTx({ description: 'Anterior', dueDate: '2026-08-01' });
    mockPage({ data: [future, past, todayPaid], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    expect(wrapper.findAll('.date-group > h2').map((heading) => heading.text())).toEqual([
      'Hoje',
      'Futuros',
      'Anteriores',
    ]);
    expect(wrapper.findAll('.date-group')[0]!.text()).toContain('Pago');
    expect(wrapper.findAll('.date-group')[0]!.text()).toContain('Conta');
  });

  it('diferencia pago e pendente e prioriza realizado quando pago', async () => {
    const { entry: paid } = makeTx({ status: 'PAID', actualAmount: '12.00', paidAt: '2026-08-01' });
    const { entry: pending } = makeTx({ id: '99999999-9999-4999-8999-999999999999' });
    mockPage({ data: [paid, pending], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    const paidCard = wrapper.get('.transaction-card--paid');
    const pendingCard = wrapper.get('.transaction-card--pending');
    expect(paidCard.get('.status-badge').text()).toBe('Pago');
    expect(paidCard.get('.entry-amount').text()).toBe('- R$ 12,00');
    expect(pendingCard.get('.status-badge').text()).toBe('Pendente');
    expect(pendingCard.get('.entry-amount').text()).toBe('- R$ 10,00');
  });

  it('cria PENDING com payload exatamente aderente ao contrato e recarrega a lista', async () => {
    mockPage();
    const { wrapper } = await mountPageWithRoute({ create: 'EXPENSE' });
    const form = await openExpenseForm(wrapper);
    await form.find('textarea').setValue('Valor com IPTU');
    await form.trigger('submit');
    await flushPromises();

    expect(submittedBody()).toEqual({
      accountId,
      categoryId,
      type: 'EXPENSE',
      status: 'PENDING',
      description: 'Aluguel',
      notes: 'Valor com IPTU',
      plannedAmount: '1800.00',
      dueDate: '2026-08-10',
    });
    expect(wrapper.find('.modal').exists()).toBe(false);
    expect(
      vi
        .mocked(authenticatedFetch)
        .mock.calls.filter(([path]) => String(path).startsWith('/financial-entries?')),
    ).toHaveLength(2);
  });

  it('cria PAID normalizando valores inteiros para strings decimais canônicas', async () => {
    mockPage();
    const { wrapper } = await mountPageWithRoute({ create: 'EXPENSE' });
    const form = await openExpenseForm(wrapper);
    await form.findAll('select')[3]!.setValue('PAID');
    const inputs = form.findAll('input');
    await inputs
      .filter((input) => input.attributes('inputmode') === 'decimal')[1]!
      .setValue('1923');
    await inputs.filter((input) => input.attributes('type') === 'date')[1]!.setValue('2026-08-11');
    await form.trigger('submit');
    await flushPromises();

    expect(submittedBody()).toMatchObject({
      status: 'PAID',
      plannedAmount: '1800.00',
      actualAmount: '1923.00',
      dueDate: '2026-08-10',
      paidAt: '2026-08-11',
    });
    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it.each([
    ['valor realizado', 'Informe um valor realizado', 'actualAmount'],
    ['data do pagamento', 'Informe a data do pagamento', 'paidAt'],
  ])('mantém o modal aberto e mostra erro quando PAID não tem %s', async (_, message, missing) => {
    mockPage();
    const { wrapper } = await mountPageWithRoute({ create: 'EXPENSE' });
    const form = await openExpenseForm(wrapper);
    await form.findAll('select')[3]!.setValue('PAID');
    const inputs = form.findAll('input');
    if (missing !== 'actualAmount')
      await inputs
        .filter((input) => input.attributes('inputmode') === 'decimal')[1]!
        .setValue('20');
    if (missing !== 'paidAt')
      await inputs
        .filter((input) => input.attributes('type') === 'date')[1]!
        .setValue('2026-08-11');
    await form.trigger('submit');

    expect(form.get('[role=alert]').text()).toContain(message);
    expect(wrapper.find('.modal').exists()).toBe(true);
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some((call) => call[1]?.method === 'POST'),
    ).toBe(false);
  });

  it.each([400, 422])(
    'preserva valores e mostra dentro do modal o detalhe seguro da API %s',
    async (status) => {
      vi.mocked(authenticatedFetch).mockImplementation((path, init) =>
        init?.method === 'POST'
          ? response(
              {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Dados inválidos.',
                  details: [
                    { field: 'plannedAmount', message: 'Informe um valor decimal positivo.' },
                  ],
                },
              },
              false,
              status,
            )
          : path === '/accounts'
            ? response([account])
            : path === '/categories'
              ? response([expenseCategory, incomeCategory])
              : response(empty),
      );
      const { wrapper } = await mountPageWithRoute({ create: 'EXPENSE' });
      const form = await openExpenseForm(wrapper);
      await form.trigger('submit');
      await flushPromises();

      expect(form.get('[role=alert]').text()).toBe('Informe um valor decimal positivo.');
      expect(wrapper.find('.modal').exists()).toBe(true);
      expect((form.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe(
        'Aluguel',
      );
      expect(
        form.findAll('input').some((input) => (input.element as HTMLInputElement).value === '1800'),
      ).toBe(true);
    },
  );

  it('limpa categoria incompatível ao trocar a natureza', async () => {
    mockPage();
    const { wrapper } = await mountPageWithRoute({ create: 'EXPENSE' });
    const form = await openExpenseForm(wrapper);
    await form.findAll('select')[0]!.setValue('INCOME');
    expect(form.findAll('select')[2]!.element.value).toBe(incomeCategory.id);
    expect(
      form
        .findAll('select')[2]!
        .findAll('option')
        .map((option) => option.text()),
    ).toEqual(['Salário']);
  });

  it('edita PENDING buscando o registro completo e envia PATCH contratual normalizado', async () => {
    const { entry, full } = makeTx();
    mockPage({ data: [entry], page: { limit: 20, nextCursor: null } }, [full]);
    const wrapper = await mountPage();
    await wrapper.get('.entry-tap').trigger('click');
    await flushPromises();
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some(([path]) => path === `/transactions/${txId}`),
    ).toBe(true);
    const form = wrapper.get('.modal form');
    await form.find('input[maxlength="200"]').setValue('Conta editada');
    await form
      .findAll('input')
      .find((input) => input.attributes('inputmode') === 'decimal')!
      .setValue('15');
    await form.trigger('submit');
    await flushPromises();
    expect(submittedBody('PATCH')).toEqual({
      description: 'Conta editada',
      notes: null,
      accountId,
      categoryId,
      type: 'EXPENSE',
      plannedAmount: '15.00',
      dueDate: '2026-08-01',
    });
  });

  it('edita PAID somente nos campos textuais', async () => {
    const { entry, full } = makeTx({ status: 'PAID', actualAmount: '10.00', paidAt: '2026-08-01' });
    mockPage({ data: [entry], page: { limit: 20, nextCursor: null } }, [full]);
    const wrapper = await mountPage();
    await wrapper.get('.entry-tap').trigger('click');
    await flushPromises();
    const form = wrapper.get('.modal form');
    await form.find('textarea').setValue('Quitada');
    await form.trigger('submit');
    await flushPromises();
    expect(submittedBody('PATCH')).toEqual({ description: 'Conta', notes: 'Quitada' });
  });

  it('marca pendente como pago com payload canônico usando data e valor do feed', async () => {
    const { entry } = makeTx();
    mockPage({ data: [entry], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    await openAction(wrapper, 'Marcar como pago');
    const form = wrapper.get('.modal form');
    await form.find('input[inputmode="decimal"]').setValue('12');
    await form.trigger('submit');
    await flushPromises();
    const call = vi.mocked(authenticatedFetch).mock.calls.find(([path]) => path.endsWith('/pay'))!;
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      actualAmount: '12.00',
      paidAt: '2026-08-01',
    });
  });

  it('cancela exclusao sem chamar API', async () => {
    const { entry } = makeTx();
    mockPage({ data: [entry], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    await openAction(wrapper, 'Excluir');
    expect(wrapper.get('.modal').text()).toContain('Excluir este lançamento?');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
    expect(wrapper.find('.modal').exists()).toBe(false);
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some((call) => call[1]?.method === 'DELETE'),
    ).toBe(false);
  });

  it('usa texto especifico para ocorrencia recorrente', async () => {
    const { entry } = makeTx({ isRecurringOccurrence: true });
    mockPage({ data: [entry], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    await openAction(wrapper, 'Excluir');
    expect(wrapper.get('.modal').text()).toContain('Excluir somente este lançamento?');
    expect(wrapper.get('.modal').text()).toContain('A recorrência continuará ativa');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
  });

  it('remove card somente apos 204 e recarrega grupos', async () => {
    const { entry } = makeTx();
    let deleted = false;
    mockPage(undefined, [], (path, init) => {
      if (init?.method === 'DELETE') {
        deleted = true;
        return Promise.resolve({ ok: true, status: 204 } as Response);
      }
      if (path.startsWith('/financial-entries?'))
        return response({ data: deleted ? [] : [entry], page: { limit: 20, nextCursor: null } });
      return undefined;
    });
    const wrapper = await mountPage();
    expect(wrapper.find('.transaction-card').exists()).toBe(true);
    await openAction(wrapper, 'Excluir');
    await wrapper.get('.modal form').trigger('submit');
    await flushPromises();
    expect(deleted).toBe(true);
    expect(wrapper.find('.transaction-card').exists()).toBe(false);
  });

  it('falha de API mantem card e mostra erro seguro', async () => {
    const { entry } = makeTx();
    mockPage({ data: [entry], page: { limit: 20, nextCursor: null } }, [], (path, init) => {
      if (init?.method === 'DELETE')
        return response(
          { error: { code: 'INTERNAL_ERROR', message: 'Falha temporária.' } },
          false,
          500,
        );
      return undefined;
    });
    const wrapper = await mountPage();
    await openAction(wrapper, 'Excluir');
    await wrapper.get('.modal form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.transaction-card').exists()).toBe(true);
    expect(wrapper.get('.modal [role=alert]').text()).toContain('Falha temporária.');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
  });
  it('limpa erro antigo ao abrir nova confirmação de exclusão', async () => {
    const { entry } = makeTx();
    const { entry: another } = makeTx({
      id: '55555555-5555-4555-8555-555555555555',
      description: 'Luz',
    });
    mockPage({ data: [entry, another], page: { limit: 20, nextCursor: null } }, [], (path, init) => {
      if (init?.method === 'DELETE')
        return response(
          { error: { code: 'INTERNAL_ERROR', message: 'Falha temporária.' } },
          false,
          500,
        );
      return undefined;
    });
    const wrapper = await mountPage();
    await openAction(wrapper, 'Excluir');
    await wrapper.get('.modal form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('.modal [role=alert]').text()).toContain('Falha temporária.');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');

    await openAction(wrapper, 'Excluir', 1);
    expect(wrapper.find('.modal [role=alert]').exists()).toBe(false);
    expect(wrapper.get('.modal').text()).toContain('Excluir este lançamento?');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
  });

  it('mantem acoes acessiveis e bloqueia scroll de fundo nos modais', async () => {
    const { entry, full } = makeTx();
    mockPage({ data: [entry], page: { limit: 20, nextCursor: null } }, [full]);
    document.body.style.overflow = '';
    const wrapper = await mountPage();
    await wrapper.get('.entry-tap').trigger('click');
    await flushPromises();
    expect(document.body.style.overflow).toBe('hidden');
    expect(wrapper.find('.modal .modal-body').exists()).toBe(true);
    expect(wrapper.find('.modal .actions').exists()).toBe(true);
    const editBack = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(editBack);
    await flushPromises();
    expect(editBack.defaultPrevented).toBe(true);
    expect(document.body.style.overflow).toBe('');
    expect(wrapper.find('.modal').exists()).toBe(false);

    await openAction(wrapper, 'Marcar como pago');
    expect(document.body.style.overflow).toBe('hidden');
    const payBack = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(payBack);
    await flushPromises();
    expect(payBack.defaultPrevented).toBe(true);
    expect(document.body.style.overflow).toBe('');
    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it('limpa a query create apos salvar pelo fluxo global', async () => {
    mockPage();
    const { wrapper, router } = await mountPageWithRoute({ create: 'EXPENSE' });
    const form = wrapper.get('.modal form');
    const selects = form.findAll('select');
    await selects[1]!.setValue(accountId);
    await selects[2]!.setValue(categoryId);
    await form.find('input[maxlength="200"]').setValue('Aluguel');
    const inputs = form.findAll('input');
    await inputs.find((input) => input.attributes('inputmode') === 'decimal')!.setValue('1800');
    await inputs.find((input) => input.attributes('type') === 'date')!.setValue('2026-08-10');
    await form.trigger('submit');
    await flushPromises();

    expect(router.replace).toHaveBeenCalledWith({ path: '/transactions' });
    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it('fecha o modal quando Back remove a query create sem sair da tela', async () => {
    mockPage();
    const { wrapper, route } = await mountPageWithRoute({ create: 'INCOME' });
    expect(wrapper.find('.modal').exists()).toBe(true);
    route.query = {};
    await flushPromises();
    expect(wrapper.find('.modal').exists()).toBe(false);
  });
});

describe('feed único inclui compras de cartão (CARD_PURCHASE)', () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00-03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra a compra do cartão na listagem com o rótulo do cartão', async () => {
    mockPage({ data: [makeCardEntry()], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    const entry = wrapper.get('.transaction-card--purchase');
    expect(entry.get('.entry-amount').text()).toBe('- R$ 150,00');
    expect(entry.get('.status-badge--card').text()).toBe('Nubank');
  });

  it('mostra quantidade de parcelas no rótulo quando a compra é parcelada', async () => {
    mockPage({
      data: [makeCardEntry({ installmentCount: 3 })],
      page: { limit: 20, nextCursor: null },
    });
    const wrapper = await mountPage();
    expect(wrapper.get('.status-badge--card').text()).toBe('Nubank · 3x');
    expect(wrapper.text()).not.toContain('1/3');
    expect(wrapper.text()).not.toContain('2/3');
    expect(wrapper.text()).not.toContain('3/3');
  });

  it('toque na compra do cartão navega para a tela do cartão', async () => {
    mockPage({ data: [makeCardEntry()], page: { limit: 20, nextCursor: null } });
    const { wrapper, router } = await mountPageWithFullRouter();
    await wrapper.get('.entry-tap').trigger('click');
    expect(router.push).toHaveBeenCalledWith(`/cards/${cardId}`);
  });

  it('menu oferece Ver no cartão e Excluir; excluir chama DELETE na compra de origem', async () => {
    const cardEntry = makeCardEntry();
    let deleted = false;
    mockPage(undefined, [], (path, init) => {
      if (init?.method === 'DELETE') {
        deleted = true;
        return Promise.resolve({ ok: true, status: 204 } as Response);
      }
      if (path.startsWith('/financial-entries?'))
        return response({
          data: deleted ? [] : [cardEntry],
          page: { limit: 20, nextCursor: null },
        });
      return undefined;
    });
    const wrapper = await mountPage();
    await openAction(wrapper, 'Excluir');
    expect(wrapper.get('.modal').text()).toContain('Excluir esta compra do cartão?');
    await wrapper.get('.modal form').trigger('submit');
    await flushPromises();
    expect(deleted).toBe(true);
    const deleteCall = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall?.[0]).toBe(`/card-purchases/${purchaseId}`);
    expect(wrapper.find('.transaction-card--purchase').exists()).toBe(false);
  });

  it('excluir compra parcelada avisa que remove a compra e parcelas abertas', async () => {
    mockPage({
      data: [makeCardEntry({ installmentCount: 3 })],
      page: { limit: 20, nextCursor: null },
    });
    const wrapper = await mountPage();
    await openAction(wrapper, 'Excluir');
    expect(wrapper.get('.modal').text()).toContain(
      'Isso remove a compra e todas as suas parcelas das faturas abertas.',
    );
  });

  it('oculta compras de cartão quando um filtro de conta está ativo', async () => {
    mockPage(undefined, [], (path) => {
      if (path.startsWith('/financial-entries?')) {
        const hasAccountFilter = path.includes('accountId=');
        return response({
          data: hasAccountFilter ? [] : [makeCardEntry()],
          page: { limit: 20, nextCursor: null },
        });
      }
      return undefined;
    });
    const wrapper = await mountPage();
    expect(wrapper.find('.transaction-card--purchase').exists()).toBe(true);
    await wrapper.get('.filter-summary button').trigger('click');
    await wrapper.get('select').setValue(accountId);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Aplicar')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.find('.transaction-card--purchase').exists()).toBe(false);
  });

  it('carrega mais usando o cursor único do feed combinado', async () => {
    const { entry: first } = makeTx({ id: '55555555-5555-4555-8555-555555555555' });
    const second = makeCardEntry();
    mockPage(undefined, [], (path) => {
      if (path.startsWith('/financial-entries?')) {
        if (path.includes('cursor='))
          return response({ data: [second], page: { limit: 1, nextCursor: null } });
        return response({ data: [first], page: { limit: 1, nextCursor: 'next-token' } });
      }
      return undefined;
    });
    const wrapper = await mountPage();
    expect(wrapper.findAll('.transaction-card')).toHaveLength(1);
    const loadMore = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Carregar mais');
    await loadMore!.trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.transaction-card')).toHaveLength(2);
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some(([path]) => String(path).includes('cursor=next-token')),
    ).toBe(true);
  });
});
