import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { routeLocationKey, routerKey } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionsPage from './pages/TransactionsPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';

const accountId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
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
const item = {
  id: '44444444-4444-4444-8444-444444444444',
  accountId,
  categoryId,
  type: 'EXPENSE',
  status: 'PENDING',
  description: 'Conta',
  notes: null,
  plannedAmount: '10.00',
  actualAmount: null,
  dueDate: '2026-08-01',
  paidAt: null,
  isOverdue: true,
  isRecurringOccurrence: false,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

function mockPage(transactions: unknown = empty) {
  vi.mocked(authenticatedFetch).mockImplementation((path) => {
    if (String(path).startsWith('/transactions?')) return response(transactions);
    if (path === '/accounts') return response([account]);
    if (path === '/categories') return response([expenseCategory, incomeCategory]);
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
async function openExpenseForm(wrapper: VueWrapper) {
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Nova despesa')!
    .trigger('click');
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
      .mock.calls.find(([path]) => String(path).startsWith('/transactions?'))!;
    expect(String(firstListCall[0])).toContain('dueDateFrom=2026-08-01');
    expect(String(firstListCall[0])).toContain('dueDateTo=2026-08-31');
  });

  it('agrupa visualmente por hoje, futuros e anteriores sem considerar status', async () => {
    const todayPaid = {
      ...item,
      id: '55555555-5555-4555-8555-555555555555',
      status: 'PAID',
      actualAmount: '10.00',
      dueDate: '2026-08-12',
      paidAt: '2026-08-12',
      isOverdue: false,
    };
    const future = {
      ...item,
      id: '66666666-6666-4666-8666-666666666666',
      description: 'Futuro',
      dueDate: '2026-08-20',
      isOverdue: false,
    };
    const past = { ...item, description: 'Anterior', dueDate: '2026-08-01' };
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
    const paid = {
      ...item,
      status: 'PAID',
      actualAmount: '12.00',
      paidAt: '2026-08-01',
      isOverdue: false,
    };
    mockPage({ data: [paid, item], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    const paidCard = wrapper.get('.transaction-card--paid');
    const pendingCard = wrapper.get('.transaction-card--pending');
    expect(paidCard.get('.status-badge').text()).toBe('Pago');
    expect(paidCard.get('.amount-main').text()).toContain('Realizado R$ 12,00');
    expect(paidCard.get('.amount-secondary').text()).toContain('Previsto R$ 10,00');
    expect(pendingCard.get('.status-badge').text()).toBe('Pendente');
    expect(pendingCard.get('.amount-main').text()).toContain('Previsto R$ 10,00');
  });

  it('cria PENDING com payload exatamente aderente ao contrato e recarrega a lista', async () => {
    mockPage();
    const wrapper = await mountPage();
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
        .mock.calls.filter(([path]) => String(path).startsWith('/transactions?')),
    ).toHaveLength(2);
  });

  it('cria PAID normalizando valores inteiros para strings decimais canônicas', async () => {
    mockPage();
    const wrapper = await mountPage();
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
    const wrapper = await mountPage();
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
      mockPage();
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
      const wrapper = await mountPage();
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
    const wrapper = await mountPage();
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

  it('edita PENDING com PATCH contratual e normaliza o valor', async () => {
    mockPage({ data: [item], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Editar')!
      .trigger('click');
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
    const paid = { ...item, status: 'PAID', actualAmount: '10.00', paidAt: '2026-08-01' };
    mockPage({ data: [paid], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Editar')!
      .trigger('click');
    const form = wrapper.get('.modal form');
    await form.find('textarea').setValue('Quitada');
    await form.trigger('submit');
    await flushPromises();
    expect(submittedBody('PATCH')).toEqual({ description: 'Conta', notes: 'Quitada' });
  });

  it('marca pendente como pago com payload canônico', async () => {
    mockPage({ data: [item], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Marcar como pago')!
      .trigger('click');
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
    mockPage({ data: [item], page: { limit: 20, nextCursor: null } });
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Excluir')!
      .trigger('click');
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
    mockPage({
      data: [{ ...item, isRecurringOccurrence: true }],
      page: { limit: 20, nextCursor: null },
    });
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Excluir')!
      .trigger('click');
    expect(wrapper.get('.modal').text()).toContain('Excluir somente este lançamento?');
    expect(wrapper.get('.modal').text()).toContain('A recorrência continuará ativa');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
  });

  it('remove card somente apos 204 e recarrega grupos', async () => {
    let deleted = false;
    vi.mocked(authenticatedFetch).mockImplementation((path, init) => {
      if (init?.method === 'DELETE') {
        deleted = true;
        return Promise.resolve({ ok: true, status: 204 } as Response);
      }
      if (String(path).startsWith('/transactions?'))
        return response({ data: deleted ? [] : [item], page: { limit: 20, nextCursor: null } });
      if (path === '/accounts') return response([account]);
      if (path === '/categories') return response([expenseCategory, incomeCategory]);
      return response({});
    });
    const wrapper = await mountPage();
    expect(wrapper.find('.transaction-card').exists()).toBe(true);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Excluir')!
      .trigger('click');
    await wrapper.get('.modal form').trigger('submit');
    await flushPromises();
    expect(deleted).toBe(true);
    expect(wrapper.find('.transaction-card').exists()).toBe(false);
  });

  it('falha de API mantem card e mostra erro seguro', async () => {
    mockPage({ data: [item], page: { limit: 20, nextCursor: null } });
    vi.mocked(authenticatedFetch).mockImplementation((path, init) => {
      if (init?.method === 'DELETE')
        return response(
          { error: { code: 'INTERNAL_ERROR', message: 'Falha temporária.' } },
          false,
          500,
        );
      if (String(path).startsWith('/transactions?'))
        return response({ data: [item], page: { limit: 20, nextCursor: null } });
      if (path === '/accounts') return response([account]);
      if (path === '/categories') return response([expenseCategory, incomeCategory]);
      return response({});
    });
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Excluir')!
      .trigger('click');
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
    const another = { ...item, id: '55555555-5555-4555-8555-555555555555', description: 'Luz' };
    mockPage({ data: [item, another], page: { limit: 20, nextCursor: null } });
    vi.mocked(authenticatedFetch).mockImplementation((path, init) => {
      if (init?.method === 'DELETE')
        return response(
          { error: { code: 'INTERNAL_ERROR', message: 'Falha temporária.' } },
          false,
          500,
        );
      if (String(path).startsWith('/transactions?'))
        return response({ data: [item, another], page: { limit: 20, nextCursor: null } });
      if (path === '/accounts') return response([account]);
      if (path === '/categories') return response([expenseCategory, incomeCategory]);
      return response({});
    });
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Excluir')!
      .trigger('click');
    await wrapper.get('.modal form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('.modal [role=alert]').text()).toContain('Falha temporária.');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');

    await wrapper
      .findAll('button')
      .filter((button) => button.text() === 'Excluir')[1]!
      .trigger('click');
    expect(wrapper.find('.modal [role=alert]').exists()).toBe(false);
    expect(wrapper.get('.modal').text()).toContain('Excluir este lançamento?');
    await wrapper
      .findAll('.modal button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
  });

  it('mantem acoes acessiveis e bloqueia scroll de fundo nos modais', async () => {
    mockPage({ data: [item], page: { limit: 20, nextCursor: null } });
    document.body.style.overflow = '';
    const wrapper = await mountPage();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Editar')!
      .trigger('click');
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

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Marcar como pago')!
      .trigger('click');
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
