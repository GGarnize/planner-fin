import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsInboxPage from './pages/NotificationsInboxPage.vue';

const mocks = vi.hoisted(() => ({
  route: { params: {} as Record<string, string> },
  push: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  markNonFinancial: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('vue-router', async () => ({
  ...(await vi.importActual<typeof import('vue-router')>('vue-router')),
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('./notifications-api', () => ({
  notificationsApi: {
    list: mocks.list,
    get: mocks.get,
    confirm: mocks.confirm,
    dismiss: mocks.dismiss,
    markNonFinancial: mocks.markNonFinancial,
  },
}));

vi.mock('./auth', () => ({ authenticatedFetch: mocks.fetch }));

const account = { id: 'acc-1', name: 'Conta Corrente', archivedAt: null };
const expenseCategory = { id: 'cat-expense', name: 'Alimentação', type: 'EXPENSE', archivedAt: null };
const incomeCategory = { id: 'cat-income', name: 'Salário', type: 'INCOME', archivedAt: null };

function notification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'n1',
    deviceId: 'device-1',
    packageName: 'com.nu.production',
    status: 'FINANCIAL_CANDIDATE',
    postedAt: '2026-08-13T19:31:00.000Z',
    receivedAt: '2026-08-13T19:31:05.000Z',
    title: 'Compra aprovada',
    text: 'Compra de R$ 42,90 em PADARIA EXEMPLO',
    subText: null,
    bigText: null,
    parsedType: 'EXPENSE',
    parsedAmount: '42.90',
    parsedDescription: 'Compra aprovada',
    classificationReasons: ['valor_detectado', 'termo_saida:compra de'],
    classifiedAt: '2026-08-13T19:31:05.000Z',
    accountId: null,
    categoryId: null,
    confirmedTransactionId: null,
    confirmedAt: null,
    dismissedAt: null,
    createdAt: '2026-08-13T19:31:05.000Z',
    updatedAt: '2026-08-13T19:31:05.000Z',
    ...overrides,
  };
}

function mountPage() {
  return mount(NotificationsInboxPage, { global: { stubs: { RouterLink: RouterLinkStub } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.route.params = {};
  mocks.fetch.mockImplementation((path: string) =>
    Promise.resolve(
      new Response(JSON.stringify(path === '/accounts' ? [account] : [expenseCategory, incomeCategory]), {
        status: 200,
      }),
    ),
  );
});

describe('NotificationsInboxPage — lista', () => {
  it('mostra estado vazio quando não há notificações', async () => {
    mocks.list.mockResolvedValue({ data: [], page: { limit: 20, offset: 0, filteredCount: 0 } });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Nenhuma notificação para revisar');
  });

  it('lista as notificações com app, data, classificação, valor e descrição', async () => {
    mocks.list.mockResolvedValue({
      data: [notification()],
      page: { limit: 20, offset: 0, filteredCount: 1 },
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Nubank');
    expect(wrapper.text()).toContain('Possível movimentação');
    expect(wrapper.text()).toContain('42.90');
    expect(wrapper.text()).toContain('Compra aprovada');
  });
});

describe('NotificationsInboxPage — detalhe', () => {
  beforeEach(() => {
    mocks.route.params = { id: 'n1' };
  });

  it('separa a notificação original minimizada da interpretação sugerida', async () => {
    mocks.get.mockResolvedValue(notification());
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Notificação original (minimizada)');
    expect(wrapper.text()).toContain('Compra de R$ 42,90 em PADARIA EXEMPLO');
    expect(wrapper.text()).toContain('Interpretação sugerida');
    expect(wrapper.text()).toContain('valor_detectado');
  });

  it('bloqueia a confirmação sem conta ou categoria selecionada', async () => {
    mocks.get.mockResolvedValue(notification({ parsedType: null, parsedAmount: null }));
    const wrapper = mountPage();
    await flushPromises();

    const confirmar = wrapper.findAll('button').find((b) => b.text() === 'Confirmar')!;
    expect(confirmar.attributes('disabled')).toBeDefined();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('confirma somente após conta e categoria compatível serem escolhidas', async () => {
    mocks.get.mockResolvedValue(notification());
    mocks.confirm.mockResolvedValue(notification({ status: 'CONFIRMED', confirmedTransactionId: 't1' }));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('select').setValue('EXPENSE');
    const selects = wrapper.findAll('select');
    await selects[1]!.setValue('acc-1');
    await selects[2]!.setValue('cat-expense');
    await flushPromises();

    const confirmar = wrapper.findAll('button').find((b) => b.text() === 'Confirmar')!;
    expect(confirmar.attributes('disabled')).toBeUndefined();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.confirm).toHaveBeenCalledWith('n1', {
      accountId: 'acc-1',
      categoryId: 'cat-expense',
      type: 'EXPENSE',
      amount: '42.90',
      description: 'Compra aprovada',
      date: '2026-08-13',
    });
  });

  it('descartar não confirma nem cria lançamento', async () => {
    mocks.get.mockResolvedValue(notification());
    mocks.dismiss.mockResolvedValue(notification({ status: 'DISMISSED' }));
    const wrapper = mountPage();
    await flushPromises();

    const descartar = wrapper.findAll('button').find((b) => b.text() === 'Descartar')!;
    await descartar.trigger('click');
    await flushPromises();

    expect(mocks.dismiss).toHaveBeenCalledWith('n1');
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Esta notificação foi descartada.');
  });

  it('nunca renderiza indícios de OTP/segredo — apenas os campos permitidos do envelope', async () => {
    mocks.get.mockResolvedValue(
      notification({ title: 'Compra aprovada', text: 'Compra de R$ 42,90 em PADARIA EXEMPLO' }),
    );
    const wrapper = mountPage();
    await flushPromises();

    const html = wrapper.html();
    expect(html).not.toContain('secretDropped');
    expect(html).not.toContain('otp');
    expect(html).not.toContain('OTP');
  });
});
