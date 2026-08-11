import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionFormPage from './pages/TransactionFormPage.vue';

const back = vi.fn();
vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ back, replace: vi.fn() }),
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
    expect((form.findAll('select')[2]!.element as HTMLSelectElement).value).toBe('');
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
});
