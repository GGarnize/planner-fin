import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import DebtsPage from './pages/DebtsPage.vue';
import { authenticatedFetch } from './auth';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
const response = (data: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => data }) as Response;
const debtDetail = {
  id: 'debt-1',
  type: 'FINANCING',
  creditorName: 'Credor',
  description: 'Contrato',
  notes: null,
  originalPrincipal: '1000.00',
  startDate: '2028-02-29',
  installmentCount: 2,
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: '2028-02-01T00:00:00.000Z',
  updatedAt: '2028-02-01T00:00:00.000Z',
  funding: null,
  projections: {
    outstandingPrincipal: '1000.00',
    paidPrincipal: '0.00',
    paidInterestAmount: '0.00',
    paidFeeAmount: '0.00',
    pendingInterestAmount: '0.00',
    pendingFeeAmount: '0.00',
    totalFutureAmount: '1000.00',
    overdueInstallmentCount: 1,
    nextInstallment: {
      id: 'installment-1',
      debtId: 'debt-1',
      installmentNumber: 1,
      dueDate: '2028-03-29',
      principalAmount: '500.00',
      interestAmount: '0.00',
      feeAmount: '0.00',
      totalAmount: '500.00',
      status: 'PENDING',
      projectedStatus: 'OVERDUE',
      paidAt: null,
    },
    projectedStatus: 'ACTIVE',
  },
  installments: [
    {
      id: 'installment-1',
      debtId: 'debt-1',
      installmentNumber: 1,
      dueDate: '2028-03-29',
      principalAmount: '500.00',
      interestAmount: '0.00',
      feeAmount: '0.00',
      totalAmount: '500.00',
      status: 'PENDING',
      projectedStatus: 'OVERDUE',
      paidAt: null,
    },
    {
      id: 'installment-2',
      debtId: 'debt-1',
      installmentNumber: 2,
      dueDate: '2028-04-29',
      principalAmount: '500.00',
      interestAmount: '0.00',
      feeAmount: '0.00',
      totalAmount: '500.00',
      status: 'PENDING',
      projectedStatus: 'PENDING',
      paidAt: null,
    },
  ],
  payments: [],
};
async function render(path = '/debts') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/mais', component: { template: '<p>Mais</p>' } },
      { path: '/debts', component: DebtsPage },
      { path: '/debts/:id', component: DebtsPage },
    ],
  });
  await router.push(path);
  await router.isReady();
  const w = mount(DebtsPage, { global: { plugins: [router] } });
  await new Promise((r) => setTimeout(r, 0));
  return w;
}
describe('página de dívidas', () => {
  beforeEach(() => vi.resetAllMocks());
  it('distingue vazio e oferece cadastro', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }));
    const w = await render();
    expect(w.text()).toContain('Nenhuma dívida encontrada');
    expect(w.text()).toContain('Nova dívida');
  });
  it('usa hierarquia Up correta na lista e no detalhe', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }));
    const list = await render();
    expect(list.get('[aria-label="Voltar"]').attributes('href')).toBe('/mais');

    vi.mocked(authenticatedFetch).mockReset();
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(debtDetail));
    const detail = await render('/debts/debt-1');
    expect(detail.get('[aria-label="Voltar"]').attributes('href')).toBe('/debts');
  });
  it('abre detalhe pela lista e prioriza resumo de saldo, proxima parcela e situacao', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          items: [
            {
              id: 'debt-1',
              type: 'FINANCING',
              creditorName: 'Credor',
              installmentCount: 2,
              status: 'ACTIVE',
              archivedAt: null,
              projections: debtDetail.projections,
            },
          ],
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(response(debtDetail));
    const w = await render();
    await w
      .findAll('button')
      .find((button) => button.text() === 'Abrir detalhe')!
      .trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(w.text()).toContain('Quanto falta');
    expect(w.text()).toContain('Próxima parcela');
    expect(w.text()).toContain('Situação');
    expect(w.text()).toContain('2 parcela(s) pendente(s)');
    expect(w.find('.schedule').text()).toContain('Vencimento');
    expect(w.find('.schedule').text()).toContain('Valor');
  });
  it('usa nomenclatura orientada ao usuário no cronograma da dívida', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }));
    const w = await render();
    await w.get('button').trigger('click');
    expect(w.text()).toContain('Parcelas');
    expect(w.text()).not.toContain('Cronograma explícito');
    expect(w.text()).toContain('Parcela 1');
    expect(w.text()).not.toContain('#1');
    expect(w.find('.installment').text()).toContain('Amortização');
    expect(w.find('.installment').text()).toContain('Juros');
    expect(w.find('.installment').text()).toContain('Tarifa');
    expect(w.text()).not.toContain('0.00');
    const scheduleInputs = w.find('.installment').findAll('input');
    expect((scheduleInputs[2]!.element as HTMLInputElement).value).toBe('');
    expect((scheduleInputs[3]!.element as HTMLInputElement).value).toBe('');
    expect((scheduleInputs[1]!.element as HTMLInputElement).value).toBe('');
    expect(scheduleInputs[1]!.attributes('placeholder')).toBe('0,00');
    expect(scheduleInputs[2]!.attributes('placeholder')).toBe('0,00');
    expect(scheduleInputs[3]!.attributes('placeholder')).toBe('0,00');
    expect(w.text()).toContain('Valor principal');
  });
  it('distingue indisponibilidade de vazio e permite tentar novamente', async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error('offline'));
    const w = await render();
    expect(w.text()).toContain('API indisponível');
    expect(w.text()).not.toContain('Nenhuma dívida encontrada');
  });
  it('renderiza filtros e paginação real', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ items: [], nextCursor: 'cursor-real' }));
    const w = await render();
    expect(w.findAll('select').length).toBeGreaterThanOrEqual(4);
    expect(w.text()).toContain('Arquivadas');
    expect(w.text()).toContain('Carregar mais');
  });
  it('arquiva somente apos confirmacao', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          items: [{ ...debtDetail, status: 'PAID_OFF', projections: debtDetail.projections }],
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }));
    const w = await render();

    await w
      .findAll('button')
      .find((button) => button.text() === 'Arquivar')!
      .trigger('click');
    expect(w.get('.confirm-dialog').text()).toContain('Credor');
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some(([path]) => String(path).endsWith('/archive')),
    ).toBe(false);

    await w.get('.confirm-dialog .danger').trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some(([path]) => String(path).endsWith('/archive')),
    ).toBe(true);
  });
  it('preserva centavos de Decimal(19,2) alto sem converter para Number', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          items: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              type: 'FINANCING',
              creditorName: 'Credor fictício',
              installmentCount: 1,
              status: 'ACTIVE',
              archivedAt: null,
              projections: {
                outstandingPrincipal: '99999999999999999.99',
                nextInstallment: null,
              },
            },
          ],
          nextCursor: null,
        }),
      );
    const w = await render();
    expect(w.text()).toContain('R$ 99.999.999.999.999.999,99');
  });
  it('envia description obrigatória e omite funding fora de LOAN', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }));
    const w = await render();
    await w.get('header button').trigger('click');
    const selects = w.findAll('form select');
    await selects[0]!.setValue('FINANCING');
    const inputs = w.findAll('form input');
    await inputs.find((x) => x.attributes('maxlength') === '120')!.setValue('Credor');
    await inputs.find((x) => x.attributes('placeholder') === '1.000,50')!.setValue('R$ 10,00');
    await inputs.filter((x) => x.attributes('type') === 'date')[0]!.setValue('2028-02-29');
    await inputs.find((x) => x.attributes('maxlength') === '200')!.setValue(' Contrato ');
    const schedule = w.find('.installment');
    await schedule.find('input[type="date"]').setValue('2028-03-29');
    await schedule.findAll('input')[1]!.setValue('10');
    await w.get('form').trigger('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = vi.mocked(authenticatedFetch).mock.calls[2]![1]!;
    const body = JSON.parse(String(request.body));
    expect(body.description).toBe(' Contrato ');
    expect(body.originalPrincipal).toBe('10.00');
    expect(body.installments[0].principalAmount).toBe('10.00');
    expect(body.installments[0].interestAmount).toBe('0.00');
    expect(body.installments[0].feeAmount).toBe('0.00');
    expect(body).not.toHaveProperty('funding');
  });
  it('mantém conta ativa com saldo indisponível selecionável para funding', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(
        response([
          { id: 'account-1', name: 'Conta futura', realizedBalance: null, archivedAt: null },
        ]),
      )
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }));
    const w = await render();
    await w.get('header button').trigger('click');
    const option = w.find('option[value="account-1"]');
    expect(option.text()).toContain('saldo atual indisponível');
    expect(option.text()).not.toContain('R$ 0,00');
    const fundingSelect = w
      .findAll('form select')
      .find((select) => select.find('option[value="account-1"]').exists())!;
    await fundingSelect.setValue('account-1');
    expect((fundingSelect.element as HTMLSelectElement).value).toBe('account-1');
  });

  it('aceita entradas monetarias pt-BR e mantem payload canonico', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }));
    const w = await render();
    await w.get('header button').trigger('click');
    await w.findAll('form select')[0]!.setValue('FINANCING');
    const inputs = w.findAll('form input');
    await inputs.find((x) => x.attributes('maxlength') === '120')!.setValue('Credor');
    await inputs.find((x) => x.attributes('placeholder') === '1.000,50')!.setValue('1.000,50');
    await inputs.filter((x) => x.attributes('type') === 'date')[0]!.setValue('2028-02-29');
    await inputs.find((x) => x.attributes('maxlength') === '200')!.setValue('Contrato');
    const schedule = w.find('.installment');
    await schedule.find('input[type="date"]').setValue('2028-03-29');
    await schedule.findAll('input')[1]!.setValue('1000,50');
    await schedule.findAll('input')[2]!.setValue('R$ 1.000,50');
    await schedule.findAll('input')[3]!.setValue('0,00');
    await w.get('form').trigger('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const body = JSON.parse(String(vi.mocked(authenticatedFetch).mock.calls[2]![1]!.body));
    expect(body.originalPrincipal).toBe('1000.50');
    expect(body.installments[0]).toMatchObject({
      principalAmount: '1000.50',
      interestAmount: '1000.50',
      feeAmount: '0.00',
    });
  });

  it('mostra labels visiveis de parcelas tambem na edicao estrutural', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          id: 'debt-1',
          type: 'FINANCING',
          creditorName: 'Credor',
          description: 'Contrato',
          notes: null,
          originalPrincipal: '1000.00',
          startDate: '2028-02-29',
          installmentCount: 1,
          status: 'ACTIVE',
          archivedAt: null,
          createdAt: '2028-02-01T00:00:00.000Z',
          updatedAt: '2028-02-01T00:00:00.000Z',
          funding: null,
          projections: {
            outstandingPrincipal: '1000.00',
            paidPrincipal: '0.00',
            paidInterestAmount: '0.00',
            paidFeeAmount: '0.00',
            pendingInterestAmount: '0.00',
            pendingFeeAmount: '0.00',
            totalFutureAmount: '1000.00',
            overdueInstallmentCount: 0,
            nextInstallment: null,
          },
          installments: [
            {
              id: 'installment-1',
              debtId: 'debt-1',
              installmentNumber: 1,
              dueDate: '2028-03-29',
              principalAmount: '1000.00',
              interestAmount: '0.00',
              feeAmount: '0.00',
              totalAmount: '1000.00',
              status: 'PENDING',
              projectedStatus: 'PENDING',
              paidAt: null,
            },
          ],
          payments: [],
        }),
      );
    const w = await render('/debts/debt-1');
    await w
      .findAll('button')
      .find((button) => button.text() === 'Editar')!
      .trigger('click');
    const installment = w.find('.edit .installment');
    expect(installment.text()).toContain('Amortização');
    expect(installment.text()).toContain('Juros');
    expect(installment.text()).toContain('Tarifa');
    const inputs = installment.findAll('input');
    expect((inputs[2]!.element as HTMLInputElement).value).toBe('');
    expect((inputs[3]!.element as HTMLInputElement).value).toBe('');
    expect(inputs[2]!.attributes('placeholder')).toBe('0,00');
    expect(inputs[3]!.attributes('placeholder')).toBe('0,00');
  });

  it('nao usa superficie branca hardcoded no formulario de dividas', () => {
    const source = readFileSync('src/pages/DebtsPage.vue', 'utf8');
    expect(source).not.toContain('background: white');
    expect(source).not.toContain('color: #172033');
    expect(source).toContain('background: var(--color-surface)');
    expect(source).toContain('color: var(--color-text)');
  });
});
