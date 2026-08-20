import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountsPage from './pages/AccountsPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) } as Response);
const account = (realizedBalance: string | null, openingBalanceDate = '2026-08-09') => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Conta teste',
  type: 'CHECKING',
  institution: null,
  currency: 'BRL',
  openingBalance: '1500.00',
  realizedBalance,
  openingBalanceDate,
  archivedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

describe('tela de contas (API mockada)', () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  it('mostra estado vazio e ação de criação', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([]));
    const wrapper = mount(AccountsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(wrapper.text()).toContain('Nenhuma conta cadastrada');
  });
  it('envia saldo como string ao criar', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response([]))
      .mockReturnValueOnce(response({}))
      .mockReturnValueOnce(response([]));
    const wrapper = mount(AccountsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('button').trigger('click');
    const inputs = wrapper.get('form').findAll('input');
    await inputs[0]!.setValue('Carteira');
    await inputs[3]!.setValue('-10.25');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    const init = vi.mocked(authenticatedFetch).mock.calls[1]![1]!;
    expect(JSON.parse(init.body as string).openingBalance).toBe('-10.25');
  });
  it('informa API indisponível e permite tentar novamente', async () => {
    vi.mocked(authenticatedFetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValue(response([]));
    const wrapper = mount(AccountsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('API indisponível');
    expect(wrapper.text()).toContain('Tentar novamente');
  });
  it('carrega arquivadas ao ativar filtro', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([]));
    const wrapper = mount(AccountsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('input[type=checkbox]').setValue(true);
    await flushPromises();
    expect(vi.mocked(authenticatedFetch)).toHaveBeenLastCalledWith(
      '/accounts?includeArchived=true',
      undefined,
    );
  });
  it.each([
    ['1500.00', 'R$ 1.500,00'],
    [null, 'Saldo indisponível'],
  ])('apresenta saldo atual %s sem confundir indisponibilidade com zero', async (balance, text) => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([account(balance)]));
    const wrapper = mount(AccountsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(wrapper.get('.entry-amount').text()).toBe(text);
    if (balance === null) expect(wrapper.text()).not.toContain('R$ 0,00');
  });
  it('move posição inicial e data de referência para o formulário de edição', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([account('1500.00')]));
    const wrapper = mount(AccountsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('.entry-tap').trigger('click');
    const inputs = wrapper.get('form').findAll('input');
    expect((inputs[3]!.element as HTMLInputElement).value).toBe('1500.00');
    expect((inputs[4]!.element as HTMLInputElement).value).toBe('2026-08-09');
  });
  it.each([
    ['passado para futuro', account('1510.00', '2026-08-07'), account(null)],
    ['futuro para passado', account(null), account('1510.00', '2026-08-07')],
  ])('reflete edição de %s usando a resposta recarregada', async (_, before, after) => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response([before]))
      .mockReturnValueOnce(response(after))
      .mockReturnValueOnce(response([after]));
    const wrapper = mount(AccountsPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await wrapper.get('.kebab-trigger').trigger('click');
    await wrapper
      .findAll('.kebab-panel button')
      .find((button) => button.text() === 'Editar')!
      .trigger('click');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('.entry-amount').text()).toBe(
      after.realizedBalance === null ? 'Saldo indisponível' : 'R$ 1.510,00',
    );
  });
});
