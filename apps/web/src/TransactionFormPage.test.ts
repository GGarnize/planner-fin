import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionFormPage from './pages/TransactionFormPage.vue';

const back = vi.fn();
const replace = vi.fn();
let routeQuery: Record<string, unknown> = {};
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => ({ query: routeQuery }),
    useRouter: () => ({ back, replace }),
  };
});
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';

const ok = (data: unknown) => Promise.resolve({ ok: true, json: async () => data } as Response);
const categories = [
  { id: 'ce', name: 'Moradia', type: 'EXPENSE', archivedAt: null },
  { id: 'ci', name: 'Salário', type: 'INCOME', archivedAt: null },
];
const account = { id: 'a', name: 'Conta', archivedAt: null };
const model = (index: number) => ({
  id: `t${index}`,
  name: index === 7 ? 'Aluguel especial' : `Modelo ${index}`,
  type: 'EXPENSE',
  categoryId: 'ce',
  categoryAvailable: true,
  description: `Descrição ${index}`,
  plannedAmount: '1800.00',
  defaultAccountId: 'a',
  defaultAccountAvailable: true,
  notes: null,
  dueDay: 10,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
});
const incomeModel = {
  ...model(20),
  id: 'ti',
  name: 'Salário mensal',
  type: 'INCOME',
  categoryId: 'ci',
  description: 'Salário',
};
function mockTemplates(count: number) {
  vi.mocked(authenticatedFetch).mockImplementation((path) =>
    path === '/accounts'
      ? ok([account])
      : path === '/categories'
        ? ok(categories)
        : ok(Array.from({ length: count }, (_, index) => model(index))),
  );
}
async function mounted(count: number) {
  mockTemplates(count);
  const wrapper = mount(TransactionFormPage);
  await flushPromises();
  await wrapper.get('.template-action > button').trigger('click');
  return wrapper;
}

describe('novo lançamento com modelos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeQuery = {};
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00-03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('inicia com vencimento hoje e seleciona conta e categoria unicas elegiveis', async () => {
    mockTemplates(0);
    const wrapper = mount(TransactionFormPage);
    await flushPromises();
    const form = wrapper.get('form');
    expect((form.find('input[type="date"]').element as HTMLInputElement).value).toBe('2026-08-12');
    expect((form.findAll('select')[1]!.element as HTMLSelectElement).value).toBe('a');
    expect((form.findAll('select')[2]!.element as HTMLSelectElement).value).toBe('ce');
  });
  it('oculta busca com 7 modelos e mostra com 8', async () => {
    const seven = await mounted(7);
    expect(seven.find('input[type="search"]').exists()).toBe(false);
    seven.unmount();
    const eight = await mounted(8);
    expect(eight.find('input[type="search"]').exists()).toBe(true);
  });
  it('busca por nome sem diferenciar caixa e limpar restaura a lista', async () => {
    const wrapper = await mounted(8);
    const search = wrapper.get('input[type="search"]');
    await search.setValue('  ALUGUEL  ');
    expect(wrapper.findAll('.template')).toHaveLength(1);
    await search.setValue('');
    expect(wrapper.findAll('.template')).toHaveLength(8);
  });
  it('limpa categoria de modelo incompatível ao trocar a natureza', async () => {
    const wrapper = await mounted(1);
    await wrapper.get('.template').trigger('click');
    const form = wrapper.get('form');
    expect((form.findAll('select')[2]!.element as HTMLSelectElement).value).toBe('ce');
    await form.findAll('select')[0]!.setValue('INCOME');
    expect((form.findAll('select')[2]!.element as HTMLSelectElement).value).toBe('ci');
  });
  it('Escape fecha seletor e Back é consumido antes de navegar', async () => {
    const wrapper = await mounted(8);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.sheet').exists()).toBe(false);
    await wrapper.get('.template-action > button').trigger('click');
    const event = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(event);
    await wrapper.vm.$nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(back).not.toHaveBeenCalled();
    expect(wrapper.find('.sheet').exists()).toBe(false);
  });
  it('cancelar substituição preserva o rascunho', async () => {
    const wrapper = await mounted(1);
    const description = wrapper.get('input[maxlength="200"]');
    await description.setValue('Meu rascunho');
    await wrapper.get('.template').trigger('click');
    expect(wrapper.find('.confirm').exists()).toBe(true);
    await wrapper.get('.confirm .secondary').trigger('click');
    expect((description.element as HTMLInputElement).value).toBe('Meu rascunho');
  });
  it('pede confirmacao antes de sair com rascunho manual sujo', async () => {
    const wrapper = await mounted(1);
    await wrapper.get('input[maxlength="200"]').setValue('Rascunho manual');
    await wrapper.get('.save .secondary').trigger('click');
    expect(wrapper.find('.confirm').text()).toContain('Descartar rascunho');
    expect(back).not.toHaveBeenCalled();
    await wrapper.get('.confirm .secondary').trigger('click');
    expect(wrapper.find('.confirm').exists()).toBe(false);
    expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe(
      'Rascunho manual',
    );
  });
  it('preenche pagamento enquanto realizado e data nao foram editados', async () => {
    mockTemplates(0);
    const wrapper = mount(TransactionFormPage);
    await flushPromises();
    const form = wrapper.get('form');
    await form.find('input[inputmode="decimal"]').setValue('100.50');
    await form.findAll('select')[3]!.setValue('PAID');
    let moneyInputs = form.findAll('input[inputmode="decimal"]');
    let dateInputs = form.findAll('input[type="date"]');
    expect((moneyInputs[1]!.element as HTMLInputElement).value).toBe('100.50');
    expect((dateInputs[1]!.element as HTMLInputElement).value).toBe('2026-08-12');
    await moneyInputs[1]!.setValue('98.00');
    await dateInputs[1]!.setValue('2026-08-10');
    await moneyInputs[0]!.setValue('120.00');
    await dateInputs[0]!.setValue('2026-08-15');
    moneyInputs = form.findAll('input[inputmode="decimal"]');
    dateInputs = form.findAll('input[type="date"]');
    expect((moneyInputs[1]!.element as HTMLInputElement).value).toBe('98.00');
    expect((dateInputs[1]!.element as HTMLInputElement).value).toBe('2026-08-10');
  });
  it('abre modelos pela natureza inicial e permite alternar receita e todos', async () => {
    routeQuery = { type: 'EXPENSE' };
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      path === '/accounts'
        ? ok([account])
        : path === '/categories'
          ? ok(categories)
          : ok([model(0), incomeModel]),
    );
    const wrapper = mount(TransactionFormPage);
    await flushPromises();
    await wrapper.get('.template-action > button').trigger('click');
    expect(wrapper.findAll('.template').map((button) => button.text())).toEqual([
      expect.stringContaining('Modelo 0'),
    ]);
    await wrapper.findAll('.template-tabs button')[1]!.trigger('click');
    expect(wrapper.findAll('.template').map((button) => button.text())).toEqual([
      expect.stringContaining('Salário mensal'),
    ]);
    await wrapper.findAll('.template-tabs button')[2]!.trigger('click');
    expect(wrapper.findAll('.template')).toHaveLength(2);
  });
});
