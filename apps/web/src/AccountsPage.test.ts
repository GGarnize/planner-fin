import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountsPage from './pages/AccountsPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) } as Response);

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
});
