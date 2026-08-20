import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { PublicFinancialCreditCard } from '@planner-fin/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CardsPage from './pages/CardsPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ params: {} }) }));

import { authenticatedFetch } from './auth';

const purchase = {
  id: 'purchase-1',
  cardId: 'card-1',
  categoryId: 'category-1',
  description: 'Mercado',
  notes: null,
  purchaseDate: '2026-08-07',
  totalAmount: '100.00',
  installmentCount: 2,
  installments: [
    {
      id: 'installment-1',
      installmentNumber: 1,
      installmentCount: 2,
      amount: '50.00',
      referenceMonth: '2026-08',
    },
    {
      id: 'installment-2',
      installmentNumber: 2,
      installmentCount: 2,
      amount: '50.00',
      referenceMonth: '2026-09',
    },
  ],
  createdAt: '2026-08-07T10:00:00.000Z',
  updatedAt: '2026-08-07T10:00:00.000Z',
};
const cards: PublicFinancialCreditCard[] = [
  {
    id: 'card-1',
    name: 'Cartão atual',
    issuer: null,
    last4: null,
    creditLimit: null,
    closingDay: 10,
    dueDay: 17,
    archivedAt: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'card-2',
    name: 'Cartão alternativo',
    issuer: null,
    last4: null,
    creditLimit: null,
    closingDay: 10,
    dueDay: 17,
    archivedAt: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
];
const categories = [
  {
    id: 'category-1',
    name: 'Alimentação',
    type: 'EXPENSE',
    color: '#cc5500',
    icon: 'RESTAURANT',
    archivedAt: null,
  },
  { id: 'category-2', name: 'Casa', type: 'EXPENSE', color: null, icon: null, archivedAt: null },
];
const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);

function mockLoadedData(currentCards = cards) {
  vi.mocked(authenticatedFetch).mockImplementation((path) => {
    const url = String(path);
    if (url.startsWith('/card-purchases')) return response({ items: [purchase], nextCursor: null });
    if (url.startsWith('/card-invoices')) return response({ items: [], nextCursor: null });
    if (url.startsWith('/cards')) return response({ items: currentCards });
    if (url.startsWith('/categories')) return response(categories);
    return response([]);
  });
}

async function openPurchaseEdit(currentCards = cards) {
  mockLoadedData(currentCards);
  const wrapper = mount(CardsPage);
  await vi.waitFor(() => expect(wrapper.text()).toContain('Mercado'));
  const purchaseMenu = wrapper.findAll('.purchase-card .kebab-trigger')[0];
  if (!purchaseMenu) throw new Error('Menu de compra não encontrado');
  await purchaseMenu.trigger('click');
  const editButton = wrapper
    .findAll('.kebab-panel button')
    .find((button) => button.text() === 'Editar compra');
  if (!editButton) throw new Error('Botão de edição da compra não encontrado');
  await editButton.trigger('click');
  return wrapper;
}

function editForm(wrapper: VueWrapper) {
  return wrapper.findAll('form').find((form) => form.text().includes('Salvar compra'))!;
}

function field(wrapper: VueWrapper, label: string) {
  const target = editForm(wrapper)
    .findAll('label')
    .find((item) => item.text().startsWith(label));
  if (!target) throw new Error(`Campo não encontrado: ${label}`);
  return target.find('input, textarea, select');
}

async function saveAndReadPatch(wrapper: VueWrapper) {
  await editForm(wrapper).trigger('submit');
  await vi.waitFor(() =>
    expect(authenticatedFetch).toHaveBeenCalledWith(
      '/card-purchases/purchase-1',
      expect.objectContaining({ method: 'PATCH' }),
    ),
  );
  const call = vi
    .mocked(authenticatedFetch)
    .mock.calls.find(([, init]) => init?.method === 'PATCH')!;
  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

describe('CardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(
        String(path).includes('card-purchases') || String(path).includes('card-invoices')
          ? { items: [], nextCursor: null }
          : String(path).startsWith('/cards')
            ? { items: [] }
            : [],
      ),
    );
  });

  it('mostra estados vazios e não solicita PAN ou CVV', async () => {
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Nenhum cartão'));
    expect(wrapper.text()).toContain('Nenhuma compra');
    expect(wrapper.text()).toContain('Nenhuma fatura');
    expect(wrapper.text()).not.toContain('CVV');
    expect(wrapper.text()).not.toContain('Número completo');
  });

  it('mantém Novo cartão e Nova compra fechados por padrão e permite cancelar', async () => {
    mockLoadedData();
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cartão atual'));
    expect(wrapper.text()).not.toContain('Cadastrar cartão');
    expect(wrapper.text()).not.toContain('Lançar compra');

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Novo cartão'))!
      .trigger('click');
    expect(wrapper.text()).toContain('Cadastrar cartão');
    await wrapper
      .findAll('.form-panel button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
    expect(wrapper.text()).not.toContain('Cadastrar cartão');

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Nova compra'))!
      .trigger('click');
    expect(wrapper.text()).toContain('Lançar compra');
    await wrapper
      .findAll('.form-panel button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
    expect(wrapper.text()).not.toContain('Lançar compra');
  });

  it('fecha o formulário depois de criar cartão com sucesso', async () => {
    mockLoadedData();
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cartão atual'));
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Novo cartão'))!
      .trigger('click');
    const form = wrapper.get('.form-panel form');
    await form.get('input[maxlength="120"]').setValue('Novo cartão');
    await form.trigger('submit');
    await vi.waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith(
        '/cards',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Cadastrar cartão'));
  });

  it('fecha o formulário depois de criar compra com sucesso', async () => {
    mockLoadedData();
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cartão atual'));
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Nova compra'))!
      .trigger('click');
    const form = wrapper.get('.form-panel form');
    await form.find('select').setValue('card-1');
    await form.findAll('select')[1]!.setValue('category-1');
    await form.find('input[maxlength="200"]').setValue('Mercado');
    await form.find('input[inputmode="decimal"]').setValue('100');
    await form.trigger('submit');
    await vi.waitFor(() =>
      expect(authenticatedFetch).toHaveBeenCalledWith(
        '/card-purchases',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Lançar compra'));
  });

  it('usa o filtro archived aprovado e paginação com limite padrão', async () => {
    mount(CardsPage);
    await vi.waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(5));
    expect(authenticatedFetch).toHaveBeenCalledWith('/cards?archived=true', undefined);
    expect(authenticatedFetch).toHaveBeenCalledWith('/card-purchases?limit=20', undefined);
    expect(authenticatedFetch).toHaveBeenCalledWith('/card-invoices?limit=20', undefined);
  });

  it('mantém conta ativa com saldo indisponível selecionável no pagamento', async () => {
    const invoice = {
      id: 'invoice-1',
      cardId: 'card-1',
      status: 'CLOSED',
      referenceMonth: '2026-08',
      total: '10.00',
      closingDate: '2026-08-10',
      dueDate: '2026-08-17',
      installments: [],
      payment: null,
    };
    vi.mocked(authenticatedFetch).mockImplementation((path) => {
      const url = String(path);
      if (url.startsWith('/cards')) return response({ items: [] });
      if (url.startsWith('/card-purchases')) return response({ items: [], nextCursor: null });
      if (url.startsWith('/card-invoices')) return response({ items: [invoice], nextCursor: null });
      if (url.startsWith('/accounts'))
        return response([
          { id: 'account-1', name: 'Conta futura', realizedBalance: null, archivedAt: null },
        ]);
      return response([]);
    });
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ago'));
    expect(wrapper.text()).not.toContain('Conta futura');
    await wrapper.get('.invoice-card .kebab-trigger').trigger('click');
    await wrapper
      .findAll('.kebab-panel button')
      .find((button) => button.text() === 'Pagar fatura')!
      .trigger('click');
    await vi.waitFor(() => expect(wrapper.text()).toContain('Conta futura'));
    const option = wrapper.find('option[value="account-1"]');
    expect(option.text()).toContain('saldo atual indisponível');
    expect(option.text()).not.toContain('R$ 0,00');
    await wrapper.find('.pay select').setValue('account-1');
    expect(wrapper.find('.pay button').attributes('disabled')).toBeUndefined();
  });

  it('renderiza fatura compacta e abre/cancela pagamento por ação explícita', async () => {
    const invoice = {
      id: 'invoice-1',
      cardId: 'card-1',
      status: 'CLOSED',
      referenceMonth: '2026-08',
      total: '1230.45',
      closingDate: '2026-08-10',
      dueDate: '2026-08-17',
      installments: [
        { id: 'i1', amount: '1000.00', purchaseDescription: 'Compra grande' },
        { id: 'i2', amount: '230.45', purchaseDescription: 'Compra menor' },
      ],
      payment: null,
    };
    vi.mocked(authenticatedFetch).mockImplementation((path) => {
      const url = String(path);
      if (url.startsWith('/cards')) return response({ items: cards });
      if (url.startsWith('/card-purchases')) return response({ items: [], nextCursor: null });
      if (url.startsWith('/card-invoices')) return response({ items: [invoice], nextCursor: null });
      if (url.startsWith('/accounts'))
        return response([{ id: 'account-1', name: 'Conta', realizedBalance: '2000.00', archivedAt: null }]);
      if (url.startsWith('/categories')) return response(categories);
      return response([]);
    });
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Ago'));
    const card = wrapper.get('.invoice-card');
    expect(card.text()).toMatch(/R\$\s*1\.230,45/);
    expect(card.text()).toContain('Cartão atual');
    expect(card.text()).toContain('Fechada');
    expect(card.text()).toContain('2 parcelas');
    expect(card.findAll('li')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('Conta pagadora');

    await wrapper.get('.invoice-card .kebab-trigger').trigger('click');
    await wrapper
      .findAll('.kebab-panel button')
      .find((button) => button.text() === 'Pagar fatura')!
      .trigger('click');
    expect(wrapper.text()).toContain('Conta pagadora');
    await wrapper
      .findAll('.pay button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
    expect(wrapper.text()).not.toContain('Conta pagadora');
  });

  it('distingue API indisponível e oferece retry', async () => {
    vi.mocked(authenticatedFetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(() => response([]));
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('API indisponível'));
    expect(wrapper.text()).toContain('Tentar novamente');
  });

  it('oferece Editar e Arquivar do cartão pelo menu de ações', async () => {
    mockLoadedData();
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cartão atual'));
    await wrapper.get('.kebab-trigger').trigger('click');
    const panelButtons = wrapper.findAll('.kebab-panel button').map((button) => button.text());
    expect(panelButtons).toEqual(['Editar', 'Arquivar']);
    await wrapper
      .findAll('.kebab-panel button')
      .find((button) => button.text() === 'Editar')!
      .trigger('click');
    expect(wrapper.text()).toContain('Salvar edição');
  });

  it('toque na compra não abre edição; Editar compra pelo KebabMenu abre', async () => {
    mockLoadedData();
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Mercado'));
    await wrapper.get('.purchase-card').trigger('click');
    expect(wrapper.text()).not.toContain('Salvar compra');

    await wrapper.get('.purchase-card .kebab-trigger').trigger('click');
    expect(wrapper.findAll('.kebab-panel button').map((button) => button.text())).toContain(
      'Editar compra',
    );
    await wrapper
      .findAll('.kebab-panel button')
      .find((button) => button.text() === 'Editar compra')!
      .trigger('click');
    expect(wrapper.text()).toContain('Salvar compra');
  });

  it('Cancelar fecha edição de compra e volta ao card compacto', async () => {
    const wrapper = await openPurchaseEdit();
    expect(wrapper.text()).toContain('Salvar compra');
    await editForm(wrapper)
      .findAll('button')
      .find((button) => button.text() === 'Cancelar')!
      .trigger('click');
    expect(wrapper.text()).not.toContain('Salvar compra');
    expect(wrapper.get('.purchase-card').text()).toContain('Mercado');
  });

  it('fecha outra compra aberta ao editar uma compra diferente', async () => {
    const another = { ...purchase, id: 'purchase-2', description: 'Farmácia' };
    vi.mocked(authenticatedFetch).mockImplementation((path) => {
      const url = String(path);
      if (url.startsWith('/card-purchases'))
        return response({ items: [purchase, another], nextCursor: null });
      if (url.startsWith('/card-invoices')) return response({ items: [], nextCursor: null });
      if (url.startsWith('/cards')) return response({ items: cards });
      if (url.startsWith('/categories')) return response(categories);
      return response([]);
    });
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Farmácia'));
    await wrapper.findAll('.purchase-card .kebab-trigger')[0]!.trigger('click');
    await wrapper
      .findAll('.kebab-panel button')
      .find((button) => button.text() === 'Editar compra')!
      .trigger('click');
    await wrapper.findAll('.purchase-card .kebab-trigger')[1]!.trigger('click');
    await wrapper
      .findAll('.kebab-panel button')
      .find((button) => button.text() === 'Editar compra')!
      .trigger('click');
    expect(wrapper.findAll('form').filter((form) => form.text().includes('Salvar compra'))).toHaveLength(1);
    expect((field(wrapper, 'Descrição').element as HTMLInputElement).value).toBe('Farmácia');
  });

  it('envia somente description quando apenas a descrição muda', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Descrição').setValue('Feira');
    expect(await saveAndReadPatch(wrapper)).toEqual({ description: 'Feira' });
  });

  it('envia somente notes quando apenas as notas mudam', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Notas').setValue('Entrega agendada');
    expect(await saveAndReadPatch(wrapper)).toEqual({ notes: 'Entrega agendada' });
  });

  it('envia somente categoryId quando apenas a categoria muda', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Categoria').setValue('category-2');
    expect(await saveAndReadPatch(wrapper)).toEqual({ categoryId: 'category-2' });
  });

  it('envia somente totalAmount canônico quando apenas o valor muda', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Valor').setValue('125.5');
    expect(await saveAndReadPatch(wrapper)).toEqual({ totalAmount: '125.50' });
  });

  it('envia somente installmentCount quando apenas a quantidade de parcelas muda', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Parcelas').setValue(3);
    expect(await saveAndReadPatch(wrapper)).toEqual({ installmentCount: 3 });
  });

  it('envia somente cardId quando apenas o cartão muda', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Cartão').setValue('card-2');
    expect(await saveAndReadPatch(wrapper)).toEqual({ cardId: 'card-2' });
  });

  it('envia somente purchaseDate quando apenas a data muda', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Data').setValue('2026-08-08');
    expect(await saveAndReadPatch(wrapper)).toEqual({ purchaseDate: '2026-08-08' });
  });

  it('encerra uma edição sem mudanças sem enviar PATCH', async () => {
    const wrapper = await openPurchaseEdit();
    await field(wrapper, 'Valor').setValue('100.0');
    await editForm(wrapper).trigger('submit');
    expect(authenticatedFetch).not.toHaveBeenCalledWith(
      '/card-purchases/purchase-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(wrapper.text()).not.toContain('Salvar compra');
  });

  it('permite edição textual quando o cartão atual está arquivado', async () => {
    const archivedCards = [{ ...cards[0]!, archivedAt: '2026-08-06T10:00:00.000Z' }, cards[1]!];
    const wrapper = await openPurchaseEdit(archivedCards);
    expect(field(wrapper, 'Cartão').text()).toContain('Cartão atual (arquivado)');
    await field(wrapper, 'Descrição').setValue('Mercado semanal');
    expect(await saveAndReadPatch(wrapper)).toEqual({ description: 'Mercado semanal' });
  });

  it('recarrega os dados depois do sucesso', async () => {
    const wrapper = await openPurchaseEdit();
    const callsBefore = vi.mocked(authenticatedFetch).mock.calls.length;
    await field(wrapper, 'Descrição').setValue('Feira');
    await saveAndReadPatch(wrapper);
    await vi.waitFor(() =>
      expect(vi.mocked(authenticatedFetch).mock.calls.length).toBeGreaterThan(callsBefore + 1),
    );
    expect(wrapper.text()).not.toContain('Salvar compra');
  });

  it('preserva a edição e mostra mensagem recuperável quando o PATCH falha', async () => {
    const wrapper = await openPurchaseEdit();
    vi.mocked(authenticatedFetch).mockImplementationOnce(() =>
      response({ error: { message: 'Conflito temporário. Tente novamente.' } }, false),
    );
    await field(wrapper, 'Descrição').setValue('Feira');
    await editForm(wrapper).trigger('submit');
    await vi.waitFor(() => expect(wrapper.text()).toContain('Conflito temporário'));
    expect(wrapper.text()).toContain('Tentar novamente');
    expect(field(wrapper, 'Descrição').element).toHaveProperty('value', 'Feira');
  });

  it('renderiza compra parcelada em card compacto com resumo e editar no KebabMenu', async () => {
    mockLoadedData();
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Mercado'));
    const card = wrapper.get('.purchase-card');
    expect(card.text()).toContain('Mercado');
    expect(card.text()).toContain('100,00');
    expect(card.text()).toContain('2x de');
    expect(card.text()).toContain('50,00');
    expect(card.text()).toContain('atual');
    expect(card.get('.material-icons').text()).toBe('restaurant');
    expect(card.text().match(/2x de/g) ?? []).toHaveLength(1);
    expect(card.findAll('li')).toHaveLength(0);
    await card.get('.kebab-trigger').trigger('click');
    expect(wrapper.text()).toContain('Editar compra');
    expect(wrapper.text()).toContain('Excluir compra');
  });

  it('renderiza compra a vista como a vista sem lista de parcelas', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) => {
      const url = String(path);
      if (url.startsWith('/card-purchases'))
        return response({
          items: [{ ...purchase, id: 'purchase-cash', installmentCount: 1, installments: [] }],
          nextCursor: null,
        });
      if (url.startsWith('/card-invoices')) return response({ items: [], nextCursor: null });
      if (url.startsWith('/cards')) return response({ items: cards });
      if (url.startsWith('/categories')) return response(categories);
      return response([]);
    });
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Mercado'));
    const card = wrapper.get('.purchase-card');
    expect(card.text()).toContain('vista');
    expect(card.findAll('li')).toHaveLength(0);
  });

  it('resume muitas parcelas sem explodir verticalmente', async () => {
    const installments = Array.from({ length: 24 }, (_, index) => ({
      id: `installment-${index + 1}`,
      installmentNumber: index + 1,
      installmentCount: 24,
      amount: '25.00',
      referenceMonth: `2026-${String((index % 12) + 1).padStart(2, '0')}`,
    }));
    vi.mocked(authenticatedFetch).mockImplementation((path) => {
      const url = String(path);
      if (url.startsWith('/card-purchases'))
        return response({
          items: [{ ...purchase, totalAmount: '600.00', installmentCount: 24, installments }],
          nextCursor: null,
        });
      if (url.startsWith('/card-invoices')) return response({ items: [], nextCursor: null });
      if (url.startsWith('/cards')) return response({ items: cards });
      if (url.startsWith('/categories')) return response(categories);
      return response([]);
    });
    const wrapper = mount(CardsPage);
    await vi.waitFor(() => expect(wrapper.text()).toContain('24x de'));
    expect(wrapper.text()).toContain('25,00');
    expect(
      wrapper
        .get('.purchase-card')
        .text()
        .match(/24x de/g) ?? [],
    ).toHaveLength(1);
    expect(wrapper.get('.purchase-card').findAll('li')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('24/24');
  });
});
