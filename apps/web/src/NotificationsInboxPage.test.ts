import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsInboxPage from './pages/NotificationsInboxPage.vue';

const mocks = vi.hoisted(() => ({
  route: { params: {} as Record<string, string>, query: {} as Record<string, string> },
  push: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  restore: vi.fn(),
  deleteDismissed: vi.fn(),
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
    restore: mocks.restore,
    deleteDismissed: mocks.deleteDismissed,
    markNonFinancial: mocks.markNonFinancial,
  },
}));

vi.mock('./auth', () => ({ authenticatedFetch: mocks.fetch }));

const account = { id: 'acc-1', name: 'Conta Corrente', archivedAt: null };
const card = { id: 'card-1', name: 'Nubank Mastercard', last4: '1234', archivedAt: null };
const expenseCategory = {
  id: 'cat-expense',
  name: 'Alimentação',
  type: 'EXPENSE',
  archivedAt: null,
};
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
    parsedCardLast4: null,
    classificationReasons: ['valor_detectado', 'termo_saida:compra de'],
    classifiedAt: '2026-08-13T19:31:05.000Z',
    accountId: null,
    cardId: null,
    categoryId: null,
    confirmedTransactionId: null,
    confirmedCardPurchaseId: null,
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
  mocks.route.query = {};
  mocks.fetch.mockImplementation((path: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          path === '/accounts'
            ? [account]
            : path === '/cards'
              ? { items: [card] }
              : [expenseCategory, incomeCategory],
        ),
        { status: 200 },
      ),
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

  it('oferece área separada e carrega apenas notificações descartadas', async () => {
    mocks.route.query = { status: 'DISMISSED' };
    mocks.list.mockResolvedValue({
      data: [notification({ status: 'DISMISSED' })],
      page: { limit: 20, offset: 0, filteredCount: 1 },
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(mocks.list).toHaveBeenCalledWith('DISMISSED');
    expect(wrapper.text()).toContain('Descartadas');
    expect(wrapper.text()).toContain('Descartada');
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

  it('mostra text e bigText idênticos uma única vez sem alterar o conteúdo recebido', async () => {
    mocks.get.mockResolvedValue(
      notification({ text: 'Compra aprovada', bigText: '  Compra   aprovada\n' }),
    );
    const wrapper = mountPage();
    await flushPromises();

    const bodyTexts = wrapper.findAll('blockquote p').map((paragraph) => paragraph.text());
    expect(bodyTexts).toEqual(['Compra aprovada']);
  });

  it('mantém text e bigText quando os conteúdos são diferentes', async () => {
    mocks.get.mockResolvedValue(
      notification({ text: 'Compra aprovada', bigText: 'Cartão final 1234' }),
    );
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.findAll('blockquote p').map((paragraph) => paragraph.text())).toEqual([
      'Compra aprovada',
      'Cartão final 1234',
    ]);
  });

  it('bloqueia a confirmação sem conta ou categoria selecionada', async () => {
    mocks.get.mockResolvedValue(notification({ parsedType: null, parsedAmount: null }));
    const wrapper = mountPage();
    await flushPromises();

    const confirmar = wrapper.findAll('button').find((b) => b.text() === 'Confirmar lançamento')!;
    expect(confirmar.attributes('disabled')).toBeDefined();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('confirma somente após conta e categoria compatível serem escolhidas', async () => {
    mocks.get.mockResolvedValue(notification());
    mocks.confirm.mockResolvedValue(
      notification({ status: 'CONFIRMED', confirmedTransactionId: 't1' }),
    );
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('select').setValue('EXPENSE');
    const selects = wrapper.findAll('select');
    await selects[1]!.setValue('account:acc-1');
    await selects[2]!.setValue('cat-expense');
    await flushPromises();

    const confirmar = wrapper.findAll('button').find((b) => b.text() === 'Confirmar lançamento')!;
    expect(confirmar.attributes('disabled')).toBeUndefined();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.confirm).toHaveBeenCalledWith('n1', {
      paymentSourceType: 'ACCOUNT',
      accountId: 'acc-1',
      categoryId: 'cat-expense',
      type: 'EXPENSE',
      amount: '42.90',
      description: 'Compra aprovada',
      date: '2026-08-13',
    });
  });

  it('confirma despesa com cartao e parcelas sem enviar conta', async () => {
    mocks.get.mockResolvedValue(notification());
    mocks.confirm.mockResolvedValue(
      notification({ status: 'CONFIRMED', confirmedCardPurchaseId: 'purchase-1' }),
    );
    const wrapper = mountPage();
    await flushPromises();

    const selects = wrapper.findAll('select');
    await selects[1]!.setValue('card:card-1');
    await wrapper.get('input[type="number"]').setValue(3);
    await selects[2]!.setValue('cat-expense');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.confirm).toHaveBeenCalledWith('n1', {
      paymentSourceType: 'CARD',
      cardId: 'card-1',
      installmentCount: 3,
      categoryId: 'cat-expense',
      type: 'EXPENSE',
      amount: '42.90',
      description: 'Compra aprovada',
      date: '2026-08-13',
    });
    expect(mocks.confirm.mock.calls[0]![1]).not.toHaveProperty('accountId');
  });

  it('para entrada mostra somente conta e remove cartao selecionado', async () => {
    mocks.get.mockResolvedValue(notification());
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.findAll('select')[1]!.setValue('card:card-1');
    expect(wrapper.find('input[type="number"]').exists()).toBe(true);
    await wrapper.findAll('select')[0]!.setValue('INCOME');
    await flushPromises();

    expect(wrapper.text()).toContain('Conta');
    expect(wrapper.text()).not.toContain('CartÃµes de crÃ©dito');
    expect(wrapper.find('input[type="number"]').exists()).toBe(false);
  });

  it('descartar não confirma nem cria lançamento', async () => {
    mocks.get.mockResolvedValue(notification());
    mocks.dismiss.mockResolvedValue(notification({ status: 'DISMISSED' }));
    const wrapper = mountPage();
    await flushPromises();

    const descartar = wrapper.findAll('button').find((b) => b.text() === 'Descartar esta captura')!;
    await descartar.trigger('click');
    await flushPromises();

    expect(mocks.dismiss).toHaveBeenCalledWith('n1');
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Notificação descartada.');
    expect(wrapper.text()).toContain('Desfazer');
  });

  it('explica a diferença entre descartar e marcar como não financeira', async () => {
    mocks.get.mockResolvedValue(notification());
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Descartar esta captura');
    expect(wrapper.text()).toContain('Você poderá restaurá-la depois.');
    expect(wrapper.text()).toContain('Não é movimentação financeira');
    expect(wrapper.text()).toContain('Promoção, aviso, limite ou mensagem informativa.');
  });

  it('desfaz o descarte usando a mesma operação de restauração', async () => {
    mocks.get.mockResolvedValue(notification());
    mocks.dismiss.mockResolvedValue(notification({ status: 'DISMISSED' }));
    mocks.restore.mockResolvedValue(notification({ status: 'FINANCIAL_CANDIDATE' }));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Descartar esta captura')!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Desfazer')!
      .trigger('click');
    await flushPromises();

    expect(mocks.restore).toHaveBeenCalledWith('n1');
    expect(wrapper.text()).toContain('Notificação restaurada para revisão.');
  });

  it('restaura uma descartada pela área de descartadas', async () => {
    mocks.route.query = { status: 'DISMISSED' };
    mocks.get.mockResolvedValue(notification({ status: 'DISMISSED' }));
    mocks.restore.mockResolvedValue(notification({ status: 'AMBIGUOUS' }));
    const wrapper = mountPage();
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Restaurar para revisar')!
      .trigger('click');
    await flushPromises();

    expect(mocks.restore).toHaveBeenCalledWith('n1');
    expect(wrapper.text()).toContain('Precisa de revisão');
  });

  it('exige confirmação antes de excluir definitivamente uma descartada', async () => {
    mocks.route.query = { status: 'DISMISSED' };
    mocks.get.mockResolvedValue(notification({ status: 'DISMISSED' }));
    mocks.deleteDismissed.mockResolvedValue(undefined);
    const confirmation = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const wrapper = mountPage();
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Excluir definitivamente')!
      .trigger('click');
    await flushPromises();

    expect(confirmation).toHaveBeenCalledWith(
      'Excluir definitivamente esta notificação descartada?',
    );
    expect(mocks.deleteDismissed).toHaveBeenCalledWith('n1');
    expect(mocks.push).toHaveBeenCalledWith('/notifications/inbox?status=DISMISSED');
    confirmation.mockRestore();
  });

  it('não oferece ações de descartadas para uma notificação confirmada', async () => {
    mocks.get.mockResolvedValue(notification({ status: 'CONFIRMED' }));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Confirmada');
    expect(wrapper.text()).not.toContain('Excluir definitivamente');
    expect(wrapper.text()).not.toContain('Descartar esta captura');
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

  it('E01/E02: exibe rótulos acentuados e o marcador de cartão sem mojibake', async () => {
    mocks.get.mockResolvedValue(notification());
    const wrapper = mountPage();
    await flushPromises();

    const cardGroup = wrapper
      .findAll('optgroup')
      .find((group) => group.attributes('label') === 'Cartões de crédito');
    expect(cardGroup).toBeTruthy();
    expect(wrapper.text()).toContain('Nubank Mastercard •••• 1234');
    expect(wrapper.html()).not.toContain('Ã');
  });

  it('T01/T02/T03: sugere a data local do aparelho a partir do postedAt em UTC, sem voltar ao dia UTC', async () => {
    mocks.get.mockResolvedValue(notification({ postedAt: '2026-08-23T01:42:00.000Z' }));
    const wrapper = mountPage();
    await flushPromises();

    const dateInput = wrapper.find('input[type="date"]');
    const expected = (() => {
      const date = new Date('2026-08-23T01:42:00.000Z');
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })();
    expect((dateInput.element as HTMLInputElement).value).toBe(expected);
    expect(expected).not.toBe('2026-08-23T01:42:00.000Z'.slice(0, 10));
  });

  it('C01: pre-seleciona o unico cartao ativo cujos ultimos 4 digitos correspondem', async () => {
    mocks.get.mockResolvedValue(
      notification({ parsedCardLast4: '1234', cardId: null, accountId: null }),
    );
    const wrapper = mountPage();
    await flushPromises();

    const paymentSelect = wrapper.findAll('select')[1]!;
    expect((paymentSelect.element as HTMLSelectElement).value).toBe('card:card-1');
  });

  it('C02: nao seleciona nenhum cartao quando nao ha correspondencia de ultimos 4 digitos', async () => {
    mocks.get.mockResolvedValue(
      notification({ parsedCardLast4: '9999', cardId: null, accountId: null }),
    );
    const wrapper = mountPage();
    await flushPromises();

    const paymentSelect = wrapper.findAll('select')[1]!;
    expect((paymentSelect.element as HTMLSelectElement).value).toBe('');
  });

  it('C03: nao adivinha quando dois cartoes ativos compartilham os mesmos ultimos 4 digitos', async () => {
    const secondCard = {
      id: 'card-2',
      name: 'Nubank Ultravioleta',
      last4: '1234',
      archivedAt: null,
    };
    mocks.fetch.mockImplementation((path: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            path === '/accounts'
              ? [account]
              : path === '/cards'
                ? { items: [card, secondCard] }
                : [expenseCategory, incomeCategory],
          ),
          { status: 200 },
        ),
      ),
    );
    mocks.get.mockResolvedValue(
      notification({ parsedCardLast4: '1234', cardId: null, accountId: null }),
    );
    const wrapper = mountPage();
    await flushPromises();

    const paymentSelect = wrapper.findAll('select')[1]!;
    expect((paymentSelect.element as HTMLSelectElement).value).toBe('');
  });

  it('C04: nao seleciona um cartao arquivado mesmo com ultimos 4 digitos correspondentes', async () => {
    const archivedCard = {
      id: 'card-3',
      name: 'Cartao Antigo',
      last4: '1234',
      archivedAt: '2026-01-01T00:00:00.000Z',
    };
    mocks.fetch.mockImplementation((path: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            path === '/accounts'
              ? [account]
              : path === '/cards'
                ? { items: [archivedCard] }
                : [expenseCategory, incomeCategory],
          ),
          { status: 200 },
        ),
      ),
    );
    mocks.get.mockResolvedValue(
      notification({ parsedCardLast4: '1234', cardId: null, accountId: null }),
    );
    const wrapper = mountPage();
    await flushPromises();

    const paymentSelect = wrapper.findAll('select')[1]!;
    expect((paymentSelect.element as HTMLSelectElement).value).toBe('');
  });

  it('U01/U02/U03: prioriza "Confirmar lançamento" em largura total e separa as ações secundárias', async () => {
    mocks.get.mockResolvedValue(notification());
    const wrapper = mountPage();
    await flushPromises();

    const confirmar = wrapper.findAll('button').find((b) => b.text() === 'Confirmar lançamento')!;
    expect(confirmar.classes()).toContain('primary');
    expect(confirmar.element.parentElement?.className).toBe('actions');

    const secondaryActions = wrapper.find('.secondary-actions');
    expect(secondaryActions.exists()).toBe(true);
    expect(secondaryActions.findAll('button')).toHaveLength(2);
  });
});
