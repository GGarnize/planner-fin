import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BudgetsPage from './pages/BudgetsPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';

const response = (data: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data) } as Response);

const mercado = '00000000-0000-4000-8000-000000000001';
const lazer = '00000000-0000-4000-8000-000000000002';
const casa = '00000000-0000-4000-8000-000000000003';

const categories = [
  {
    id: mercado,
    name: 'Mercado',
    type: 'EXPENSE',
    color: '#112233',
    icon: 'RESTAURANT',
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: lazer,
    name: 'Lazer',
    type: 'EXPENSE',
    color: '#445566',
    icon: 'SHOPPING_CART',
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: casa,
    name: 'Casa',
    type: 'EXPENSE',
    color: '#778899',
    icon: 'HOME',
    archivedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '',
    updatedAt: '',
  },
];

const projected = {
  id: '00000000-0000-4000-8000-000000000010',
  month: '2026-08',
  totalLimit: '1000.00',
  notes: null,
  totals: {
    realizedExpense: '820.00',
    committedExpense: '1130.00',
    remainingAgainstRealized: '180.00',
    remainingAgainstCommitted: '-130.00',
    realizedPercent: '82.00',
    committedPercent: '113.00',
    unbudgetedRealizedExpense: '120.00',
    unbudgetedCommittedExpense: '130.00',
    uncategorizedDebtCostRealized: '10.00',
    uncategorizedDebtCostCommitted: '10.00',
  },
  categories: [
    {
      categoryId: mercado,
      categoryName: 'Mercado',
      categoryArchived: false,
      limitAmount: '1000.00',
      realizedExpense: '700.00',
      committedExpense: '800.00',
      remainingAgainstRealized: '300.00',
      remainingAgainstCommitted: '200.00',
      realizedPercent: '70.00',
      committedPercent: '80.00',
    },
    {
      categoryId: casa,
      categoryName: 'Casa',
      categoryArchived: true,
      limitAmount: '100.00',
      realizedExpense: '120.00',
      committedExpense: '200.00',
      remainingAgainstRealized: '-20.00',
      remainingAgainstCommitted: '-100.00',
      realizedPercent: '120.00',
      committedPercent: '200.00',
    },
  ],
  createdAt: '',
  updatedAt: '',
};

function mockInitialBudget(data: unknown = projected) {
  vi.mocked(authenticatedFetch).mockReturnValueOnce(response(categories)).mockReturnValueOnce(response(data));
}

async function mountPage() {
  const wrapper = mount(BudgetsPage, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

async function startCreate(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Criar orçamento')!
    .trigger('click');
}

describe('tela de orçamento mensal', () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.TZ;
    document.body.innerHTML = '';
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

  it('diferencia mês sem orçamento de falha de rede e exibe empty state compacto', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain('Nenhum orçamento neste mês');
    expect(wrapper.text()).toContain('Defina um limite total');
    expect(wrapper.findAll('button').some((button) => button.text() === 'Criar orçamento')).toBe(true);
  });

  it.each([
    ['100', '100.00'],
    ['100,00', '100.00'],
    ['1.000,00', '1000.00'],
    ['1000.00', '1000.00'],
    ['1000', '1000.00'],
    ['1000,00', '1000.00'],
  ])('normaliza limite total %s para %s antes de enviar', async (input, expected) => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await startCreate(wrapper);
    await wrapper.get('input[placeholder="5.000,00"]').setValue(input);
    vi.mocked(authenticatedFetch).mockReturnValueOnce(response(projected, 201));

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    expect(JSON.parse(vi.mocked(authenticatedFetch).mock.calls.at(-1)![1]!.body as string)).toMatchObject({
      totalLimit: expected,
      categories: [],
      notes: null,
    });
  });

  it('normaliza limite de categoria e envia a lista completa canônica', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await startCreate(wrapper);
    await wrapper.get('input[placeholder="5.000,00"]').setValue('1.000,00');
    await wrapper.get('select').setValue(mercado);
    await wrapper.get('.category-edit input').setValue('100,00');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(response(projected, 201));

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    expect(JSON.parse(vi.mocked(authenticatedFetch).mock.calls.at(-1)![1]!.body as string)).toMatchObject({
      totalLimit: '1000.00',
      categories: [{ categoryId: mercado, limitAmount: '100.00' }],
    });
  });

  it('bloqueia valor inválido e zero sem chamar a API de criação', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await startCreate(wrapper);
    await wrapper.get('input[placeholder="5.000,00"]').setValue('0');

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('O limite deve ser maior que zero.');
    expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledTimes(2);

    await wrapper.get('input[placeholder="5.000,00"]').setValue('abc');
    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Informe um valor válido.');
    expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledTimes(2);
  });

  it('aproveita detalhes de validação da API como erro de campo e mantém erro geral legível', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await startCreate(wrapper);
    await wrapper.get('input[placeholder="5.000,00"]').setValue('100');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(
      response(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: [{ field: 'totalLimit', message: 'totalLimit must match pattern' }],
          },
        },
        400,
      ),
    );

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Dados inválidos.');
    expect(wrapper.text()).toContain('Informe um valor válido.');
  });

  it('associa detalhe aninhado ao limite da categoria correta sem limpar o formulário', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await startCreate(wrapper);
    await wrapper.get('input[placeholder="5.000,00"]').setValue('1000');
    await wrapper.get('select').setValue(mercado);
    await wrapper.get('select').setValue(lazer);
    const inputs = wrapper.findAll('.category-edit input');
    await inputs[0]!.setValue('100');
    await inputs[1]!.setValue('200');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(
      response(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: [
              {
                field: 'categories.1.limitAmount',
                message: 'limitAmount must match pattern',
              },
            ],
          },
        },
        400,
      ),
    );

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    const currentInputs = wrapper.findAll('.category-edit input');
    expect(currentInputs[0]!.attributes('aria-invalid')).toBe('false');
    expect(currentInputs[1]!.attributes('aria-invalid')).toBe('true');
    expect((currentInputs[0]!.element as HTMLInputElement).value).toBe('100');
    expect((currentInputs[1]!.element as HTMLInputElement).value).toBe('200');
    expect(wrapper.findAll('.category-edit')[0]!.text()).not.toContain(
      'Revise o limite desta categoria.',
    );
    expect(wrapper.findAll('.category-edit')[1]!.text()).toContain(
      'Revise o limite desta categoria.',
    );
  });

  it('associa categoryId inválido à categoria indicada pelo índice', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await startCreate(wrapper);
    await wrapper.get('input[placeholder="5.000,00"]').setValue('1000');
    await wrapper.get('select').setValue(mercado);
    await wrapper.get('select').setValue(lazer);
    const inputs = wrapper.findAll('.category-edit input');
    await inputs[0]!.setValue('100');
    await inputs[1]!.setValue('200');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(
      response(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: [
              { field: 'categories.1.categoryId', message: 'categoryId must be a UUID' },
            ],
          },
        },
        400,
      ),
    );

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    expect(wrapper.findAll('.category-edit')[0]!.text()).not.toContain('Revise esta categoria.');
    expect(wrapper.findAll('.category-edit')[1]!.text()).toContain('Revise esta categoria.');
  });

  it('mantém o erro geral quando não existe detalhe mapeável', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response(categories))
      .mockReturnValueOnce(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await startCreate(wrapper);
    await wrapper.get('input[placeholder="5.000,00"]').setValue('100');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(
      response(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: [{ field: 'campoDesconhecido', message: 'erro desconhecido' }],
          },
        },
        400,
      ),
    );

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[role=alert]').text()).toContain('Dados inválidos.');
    expect(wrapper.get('input[placeholder="5.000,00"]').attributes('aria-invalid')).toBe('false');
  });

  it('apresenta falha recuperável de leitura em vez de estado vazio', async () => {
    vi.mocked(authenticatedFetch).mockReturnValueOnce(response(categories)).mockRejectedValueOnce(new Error('offline'));
    const wrapper = await mountPage();

    expect(wrapper.get('[role=alert]').text()).toContain('API indisponível');
    expect(wrapper.text()).not.toContain('Nenhum orçamento neste mês');
  });

  it('renderiza resumo compacto, categorias com ícone, excedido, arquivada e outras despesas', async () => {
    mockInitialBudget();
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain('Resumo');
    expect(wrapper.text()).toContain('Limite comprometido excedido');
    expect(wrapper.text()).toContain('R$ 800,00 / R$ 1.000,00');
    expect(wrapper.text()).toContain('Excedida');
    expect(wrapper.text()).toContain('Arquivada');
    expect(wrapper.findAllComponents({ name: 'CategoryIcon' }).length).toBeGreaterThanOrEqual(2);
    expect(wrapper.findAll('.category-row').length).toBe(2);
    const meters = wrapper.findAll('[role="meter"]');
    expect(meters[0]!.attributes('aria-valuenow')).toBe('100');
    expect(meters[0]!.attributes('aria-valuemax')).toBe('100');
    expect(meters[0]!.attributes('aria-valuetext')).toContain('113% comprometido');
    expect(meters[0]!.attributes('aria-valuetext')).toContain('limite excedido');
    expect(meters[1]!.attributes('aria-valuenow')).toBe('80');
    expect(meters[1]!.attributes('aria-valuetext')).toBe('Mercado: 80% comprometido');
    expect(meters[2]!.attributes('aria-valuenow')).toBe('100');
    expect(meters[2]!.attributes('aria-valuetext')).toContain('Casa: 200% comprometido');
    expect(meters[2]!.attributes('aria-valuetext')).toContain('limite excedido');
    expect(wrapper.text()).toContain('Sem limite específico');
    expect(wrapper.text()).toContain('Custos de dívida não categorizados');
    expect(wrapper.text().toLowerCase()).not.toContain('saldo');
  });

  it('abre edição, preserva categoria arquivada, remove categoria e cancela', async () => {
    mockInitialBudget();
    const wrapper = await mountPage();

    await wrapper.findAll('button').find((button) => button.text().includes('Editar orçamento'))!.trigger('click');
    expect(wrapper.classes()).toContain('budgets--editing');
    expect(wrapper.text()).toContain('(arquivada)');
    expect(wrapper.findAll('.category-edit')).toHaveLength(2);

    await wrapper.get('button[aria-label="Remover Mercado"]').trigger('click');
    expect(wrapper.findAll('.category-edit')).toHaveLength(1);

    await wrapper.findAll('button').find((button) => button.text() === 'Cancelar')!.trigger('click');
    expect(wrapper.find('form.budget-form').exists()).toBe(false);
    expect(wrapper.text()).toContain('Resumo');
  });

  it('salva edição com valor pt-BR sem alterar contrato de PATCH', async () => {
    mockInitialBudget();
    const wrapper = await mountPage();
    await wrapper.findAll('button').find((button) => button.text().includes('Editar orçamento'))!.trigger('click');
    await wrapper.get('input[placeholder="5.000,00"]').setValue('2.000,00');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(response({ ...projected, totalLimit: '2000.00' }));

    await wrapper.get('form.budget-form').trigger('submit');
    await flushPromises();

    const call = vi.mocked(authenticatedFetch).mock.calls.at(-1)!;
    expect(call[0]).toBe(`/budgets/${projected.id}`);
    expect(call[1]?.method).toBe('PATCH');
    expect(JSON.parse(call[1]!.body as string).totalLimit).toBe('2000.00');
  });

  it('mantém copy pelo menu secundário', async () => {
    mockInitialBudget();
    const wrapper = await mountPage();
    await wrapper.get('.kebab-trigger').trigger('click');
    await wrapper.findAll('.kebab-panel button').find((button) => button.text() === 'Copiar orçamento')!.trigger('click');
    await wrapper.get('input[type="month"]').setValue('2026-09');
    vi.mocked(authenticatedFetch).mockReturnValueOnce(response({ ...projected, month: '2026-09' }, 201));

    await wrapper.get('form.copy-panel').trigger('submit');
    await flushPromises();

    const call = vi.mocked(authenticatedFetch).mock.calls.at(-1)!;
    expect(call[0]).toBe(`/budgets/${projected.id}/copy`);
    expect(call[1]?.method).toBe('POST');
    expect(JSON.parse(call[1]!.body as string)).toEqual({ targetMonth: '2026-09' });
  });

  it('navega mês a mês usando uma consulta exata', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response({ error: {} }, 404));
    const wrapper = await mountPage();
    await wrapper.get('button[aria-label="Próximo mês"]').trigger('click');
    await flushPromises();

    expect(vi.mocked(authenticatedFetch).mock.calls.at(-1)![0]).toMatch(
      /^\/budgets\?month=\d{4}-\d{2}$/,
    );
  });
});
