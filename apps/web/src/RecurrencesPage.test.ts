import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecurrencesPage from './pages/RecurrencesPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';

const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);
const account = { id: 'a', name: 'Conta sintética', archivedAt: null };
const categories = [
  { id: 'ce', name: 'Moradia', type: 'EXPENSE', archivedAt: null },
  { id: 'ci', name: 'Salário', type: 'INCOME', archivedAt: null },
];
const model = (index = 0, available = true) => ({
  id: `t${index}`,
  name: index === 7 ? 'Aluguel especial' : `Modelo ${index}`,
  type: 'EXPENSE',
  categoryId: 'ce',
  categoryAvailable: available,
  description: index === 7 ? 'Aluguel sintético especial' : `Descrição sintética ${index}`,
  plannedAmount: '1800.00',
  defaultAccountId: 'a',
  defaultAccountAvailable: available,
  notes: 'Contrato sintético',
  dueDay: 10,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
});

function mockApi(templateCount = 1, available = true) {
  vi.mocked(authenticatedFetch).mockImplementation((path) => {
    if (path === '/accounts?includeArchived=true') return response([account]);
    if (path === '/categories?includeArchived=true') return response(categories);
    if (path === '/transaction-templates')
      return response(Array.from({ length: templateCount }, (_, index) => model(index, available)));
    return response([]);
  });
}
async function mounted(templateCount = 1, available = true) {
  mockApi(templateCount, available);
  const wrapper = mount(RecurrencesPage);
  await flushPromises();
  await wrapper.get('.template-action > button').trigger('click');
  return wrapper;
}

describe('RecurrencesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mantém criação manual disponível e trata falha de modelos separadamente', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      path === '/transaction-templates'
        ? Promise.reject(new Error('offline'))
        : response(path === '/accounts?includeArchived=true' ? [account] : []),
    );
    const wrapper = mount(RecurrencesPage);
    await flushPromises();
    expect(wrapper.text()).toContain('Você ainda pode preencher a recorrência manualmente');
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('oculta busca com 7 modelos, mostra com 8 e filtra com trim sem diferenciar caixa', async () => {
    const seven = await mounted(7);
    expect(seven.find('input[type="search"]').exists()).toBe(false);
    seven.unmount();
    const eight = await mounted(8);
    const search = eight.get('input[type="search"]');
    await search.setValue('  ALUGUEL  ');
    await eight.vm.$nextTick();
    expect(eight.findAll('.template-option')).toHaveLength(1);
    await search.setValue('inexistente');
    expect(eight.text()).toContain('Nenhum modelo encontrado para esta busca');
  });

  it('aplica somente defaults compatíveis, preserva calendário e remove apenas a indicação', async () => {
    const wrapper = await mounted();
    const form = wrapper.get('form');
    const selects = form.findAll('select');
    await selects[1]!.setValue('YEARLY');
    const dates = form.findAll('input[type="date"]');
    await dates[0]!.setValue('2026-09-03');
    await dates[1]!.setValue('2028-01-02');
    await wrapper.get('.template-option').trigger('click');
    expect(wrapper.find('.confirm').exists()).toBe(true);
    await wrapper.get('.confirm button:last-child').trigger('click');
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('YEARLY');
    expect((dates[0]!.element as HTMLInputElement).value).toBe('2026-09-03');
    expect((dates[1]!.element as HTMLInputElement).value).toBe('2028-01-02');
    expect(form.text()).toContain('Modelo: Modelo 0');
    const description = form.get('input[maxlength="200"]');
    expect((description.element as HTMLInputElement).value).toBe('Descrição sintética 0');
    await form.get('.template-action .link').trigger('click');
    expect(form.text()).not.toContain('Modelo:');
    expect((description.element as HTMLInputElement).value).toBe('Descrição sintética 0');
  });

  it('cancelar troca preserva integralmente o rascunho e referências indisponíveis ficam vazias', async () => {
    const wrapper = await mounted(1, false);
    const description = wrapper.get('input[maxlength="200"]');
    await description.setValue('Meu rascunho');
    await wrapper.get('.template-option').trigger('click');
    await wrapper.get('.confirm .secondary').trigger('click');
    expect((description.element as HTMLInputElement).value).toBe('Meu rascunho');
    await wrapper.get('.template-option').trigger('click');
    await wrapper.get('.confirm button:last-child').trigger('click');
    expect(wrapper.text()).toContain('categoria padrão está indisponível');
    expect(wrapper.text()).toContain('conta padrão está indisponível');
    const selects = wrapper.get('form').findAll('select');
    expect((selects[3]!.element as HTMLSelectElement).value).toBe('');
    expect((selects[4]!.element as HTMLSelectElement).value).toBe('');
  });

  it('limpa categoria incompatível e salva valor canônico sem vínculo com o modelo', async () => {
    const wrapper = await mounted();
    await wrapper.get('.template-option').trigger('click');
    const form = wrapper.get('form');
    const selects = form.findAll('select');
    await selects[2]!.setValue('INCOME');
    expect((selects[4]!.element as HTMLSelectElement).value).toBe('');
    await selects[2]!.setValue('EXPENSE');
    await selects[3]!.setValue('a');
    await selects[4]!.setValue('ce');
    await form.get('input[placeholder="0.00"]').setValue('1923');
    await form.get('input[maxlength="200"]').setValue('Aluguel independente');
    await form.trigger('submit');
    await flushPromises();
    const request = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(([, init]) => init?.method === 'POST');
    const body = JSON.parse(String(request?.[1]?.body));
    expect(body.plannedAmount).toBe('1923.00');
    expect(body).not.toHaveProperty('templateId');
    expect(body).not.toHaveProperty('sourceTemplateId');
    expect(body).not.toHaveProperty('actualAmount');
    expect(body).not.toHaveProperty('paidAt');
    expect(model().plannedAmount).toBe('1800.00');
  });

  it('Escape e Back Android fecham confirmação antes do seletor e devolvem o foco', async () => {
    mockApi();
    const wrapper = mount(RecurrencesPage, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('.template-action > button').trigger('click');
    await wrapper.get('input[maxlength="200"]').setValue('Rascunho');
    await wrapper.get('.template-option').trigger('click');
    const back = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(back);
    await wrapper.vm.$nextTick();
    expect(back.defaultPrevented).toBe(true);
    expect(wrapper.find('.confirm').exists()).toBe(false);
    expect(wrapper.find('.sheet').exists()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await flushPromises();
    expect(wrapper.find('.sheet').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('.template-action > button').element);
    wrapper.unmount();
  });
});
