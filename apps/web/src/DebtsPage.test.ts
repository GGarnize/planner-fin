import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import DebtsPage from './pages/DebtsPage.vue';
import { authenticatedFetch } from './auth';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
const response = (data: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => data }) as Response;
async function render(path = '/debts') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
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
    await inputs.find((x) => x.attributes('placeholder') === '1000.00')!.setValue('10.00');
    await inputs.filter((x) => x.attributes('type') === 'date')[0]!.setValue('2028-02-29');
    await inputs.find((x) => x.attributes('maxlength') === '200')!.setValue(' Contrato ');
    const schedule = w.find('.installment');
    await schedule.find('input[type="date"]').setValue('2028-03-29');
    await schedule.findAll('input')[1]!.setValue('10.00');
    await schedule.findAll('input')[2]!.setValue('0.00');
    await schedule.findAll('input')[3]!.setValue('0.00');
    await w.get('form').trigger('submit');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = vi.mocked(authenticatedFetch).mock.calls[2]![1]!;
    const body = JSON.parse(String(request.body));
    expect(body.description).toBe(' Contrato ');
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
});
