import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecurrencesPage from './pages/RecurrencesPage.vue';

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';

const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);
const account = { id: 'a', name: 'Conta sintética', archivedAt: null };
const secondAccount = { id: 'b', name: 'Conta sintética B', archivedAt: null };
const categories = [
  { id: 'ce', name: 'Moradia', type: 'EXPENSE', archivedAt: null },
  { id: 'ci', name: 'Salário', type: 'INCOME', archivedAt: null },
];
const recurrence = {
  id: 'r1',
  kind: 'TRANSACTION',
  transactionType: 'EXPENSE',
  frequency: 'MONTHLY',
  dayOfMonth: 10,
  startDate: '2026-09-01',
  endDate: null,
  accountId: 'a',
  categoryId: 'ce',
  plannedAmount: '1800.00',
  description: 'Aluguel recorrente',
  notes: 'Contrato sintético',
  status: 'ACTIVE',
  nextOccurrenceDate: '2026-10-10',
  attentionStatus: 'READY',
  blockedReason: null,
  blockedResourceType: null,
  blockedResourceId: null,
  blockedAt: null,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
};
const pausedRecurrence = { ...recurrence, id: 'r2', description: 'Assinatura', status: 'PAUSED' };
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

function mockApi(
  options: { templateCount?: number; available?: boolean; recurrences?: unknown[] } = {},
) {
  const { templateCount = 1, available = true, recurrences = [] } = options;
  vi.mocked(authenticatedFetch).mockImplementation((path, init) => {
    if (path === '/accounts?includeArchived=true') return response([account, secondAccount]);
    if (path === '/categories?includeArchived=true') return response(categories);
    if (path === '/transaction-templates')
      return response(Array.from({ length: templateCount }, (_, index) => model(index, available)));
    if (path === '/recurrences?includeArchived=true') return response(recurrences);
    if (String(path).startsWith('/recurrences') && init?.method) return response({});
    return response([]);
  });
}
async function mountPage(options: Parameters<typeof mockApi>[0] = {}) {
  mockApi(options);
  const wrapper = mount(RecurrencesPage, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}
async function openCreate(options: Parameters<typeof mockApi>[0] = {}) {
  const wrapper = await mountPage(options);
  await wrapper.get('button').trigger('click');
  await wrapper.vm.$nextTick();
  return wrapper;
}
async function openTemplate(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  await wrapper.get('.template-action > button').trigger('click');
  await wrapper.vm.$nextTick();
}
async function fillRequiredForm(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  const form = wrapper.get('form');
  const selects = form.findAll('select');
  await selects[3]!.setValue('a');
  await selects[4]!.setValue('ce');
  await form.get('input[placeholder="0.00"]').setValue('1923');
  await form.get('input[maxlength="200"]').setValue('Aluguel independente');
}

describe('RecurrencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('inicia em modo lista sem renderizar formulário', async () => {
    const wrapper = await mountPage({ recurrences: [recurrence] });
    expect(wrapper.text()).toContain('Suas recorrências');
    expect(wrapper.text()).toContain('Aluguel recorrente');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.get('button').text()).toBe('Nova recorrência');
  });

  it('estado vazio convida criação sem renderizar formulário inteiro', async () => {
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain('Nenhuma recorrência cadastrada');
    expect(wrapper.find('form').exists()).toBe(false);
    await wrapper.get('.empty button').trigger('click');
    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('Nova recorrência abre criação e mantém criação manual mesmo se modelos falharem', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      path === '/transaction-templates'
        ? Promise.reject(new Error('offline'))
        : response(path === '/accounts?includeArchived=true' ? [account] : []),
    );
    const wrapper = mount(RecurrencesPage);
    await flushPromises();
    await wrapper.get('button').trigger('click');
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.text()).toContain('Você ainda pode preencher a recorrência manualmente');
  });

  it('Editar abre modo dedicado preenchido e mantém tipo não editável', async () => {
    const wrapper = await mountPage({ recurrences: [recurrence] });
    await wrapper.get('article .secondary').trigger('click');
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Suas recorrências');
    expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe(
      'Aluguel recorrente',
    );
    expect((wrapper.get('form select').element as HTMLSelectElement).disabled).toBe(true);
  });

  it('salvar criação retorna à lista atualizada', async () => {
    const wrapper = await openCreate();
    await fillRequiredForm(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('Suas recorrências');
    const request = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(([, init]) => init?.method === 'POST');
    expect(request?.[0]).toBe('/recurrences');
  });

  it('salvar edição retorna à lista usando PATCH', async () => {
    const wrapper = await mountPage({ recurrences: [recurrence] });
    await wrapper.get('article .secondary').trigger('click');
    await wrapper.get('input[maxlength="200"]').setValue('Aluguel editado');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('form').exists()).toBe(false);
    const request = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(request?.[0]).toBe('/recurrences/r1');
  });

  it('Voltar limpo retorna sem confirmação', async () => {
    const wrapper = await openCreate();
    await wrapper.get('form .actions .secondary').trigger('click');
    expect(wrapper.find('.confirm').exists()).toBe(false);
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('Voltar sujo abre confirmação, cancelar preserva valores e confirmar retorna à lista', async () => {
    const wrapper = await openCreate();
    const description = wrapper.get('input[maxlength="200"]');
    await description.setValue('Rascunho protegido');
    await wrapper.get('form .actions .secondary').trigger('click');
    expect(wrapper.text()).toContain('Descartar alterações?');
    await wrapper.get('.confirm .secondary').trigger('click');
    expect((description.element as HTMLInputElement).value).toBe('Rascunho protegido');
    await wrapper.get('form .actions .secondary').trigger('click');
    await wrapper.get('.confirm button:last-child').trigger('click');
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toContain('Suas recorrências');
  });

  it('Android Back limpo volta do formulário para a lista', async () => {
    const wrapper = await openCreate();
    const back = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(back);
    await wrapper.vm.$nextTick();
    expect(back.defaultPrevented).toBe(true);
    expect(wrapper.find('form').exists()).toBe(false);
    wrapper.unmount();
  });

  it('Android Back sujo abre confirmação de descarte', async () => {
    const wrapper = await openCreate();
    await wrapper.get('input[maxlength="200"]').setValue('Rascunho');
    const back = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(back);
    await wrapper.vm.$nextTick();
    expect(back.defaultPrevented).toBe(true);
    expect(wrapper.text()).toContain('Descartar alterações?');
    expect(wrapper.find('form').exists()).toBe(true);
    wrapper.unmount();
  });

  it('diálogo de modelo continua consumindo Back antes do formulário', async () => {
    const wrapper = await openCreate({ templateCount: 2 });
    await openTemplate(wrapper);
    await wrapper.get('input[maxlength="200"]').setValue('Rascunho');
    await wrapper.get('.template-option').trigger('click');
    const firstBack = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(firstBack);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.confirm').exists()).toBe(false);
    expect(wrapper.find('.sheet').exists()).toBe(true);
    const secondBack = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(secondBack);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.sheet').exists()).toBe(false);
    expect(wrapper.find('form').exists()).toBe(true);
    wrapper.unmount();
  });

  it('aplica modelo, preserva regras e salva sem vínculo persistente', async () => {
    const wrapper = await openCreate();
    await openTemplate(wrapper);
    await wrapper.get('.template-option').trigger('click');
    expect(wrapper.get('.template-action').text()).toContain('Modelo: Modelo 0');
    expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe(
      'Descrição sintética 0',
    );
    await fillRequiredForm(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    const request = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(([, init]) => init?.method === 'POST');
    const body = JSON.parse(String(request?.[1]?.body));
    expect(body.plannedAmount).toBe('1923.00');
    expect(body).not.toHaveProperty('templateId');
    expect(body).not.toHaveProperty('sourceTemplateId');
  });

  it('mantém confirmação de troca de modelo e avisos de referências indisponíveis', async () => {
    const wrapper = await openCreate({ templateCount: 2, available: false });
    await openTemplate(wrapper);
    await wrapper.get('input[maxlength="200"]').setValue('Meu rascunho');
    await wrapper.get('.template-option').trigger('click');
    await wrapper.get('.confirm .secondary').trigger('click');
    expect((wrapper.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe(
      'Meu rascunho',
    );
    await wrapper.get('.template-option').trigger('click');
    await wrapper.get('.confirm button:last-child').trigger('click');
    expect(wrapper.text()).toContain('categoria padrão está indisponível');
    expect(wrapper.text()).toContain('conta padrão está indisponível');
  });

  it('não mostra ação nem aviso de modelos em recorrência de transferência', async () => {
    const wrapper = await openCreate();
    await wrapper.get('form select').setValue('TRANSFER');
    expect(wrapper.text()).not.toContain('Usar modelo');
    expect(wrapper.text()).not.toContain('Você ainda pode preencher a recorrência manualmente');
  });

  it('oculta busca com 7 modelos, mostra com 8 e filtra com trim sem diferenciar caixa', async () => {
    const seven = await openCreate({ templateCount: 7 });
    await openTemplate(seven);
    expect(seven.find('input[type="search"]').exists()).toBe(false);
    seven.unmount();
    const eight = await openCreate({ templateCount: 8 });
    await openTemplate(eight);
    const search = eight.get('input[type="search"]');
    await search.setValue('  ALUGUEL  ');
    expect(eight.findAll('.template-option')).toHaveLength(1);
    await search.setValue('inexistente');
    expect(eight.text()).toContain('Nenhum modelo encontrado para esta busca');
  });

  it('mantém ações pause, resume, generate e archive acessíveis na lista', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const wrapper = await mountPage({ recurrences: [recurrence, pausedRecurrence] });
    expect(wrapper.text()).toContain('Editar');
    expect(wrapper.text()).toContain('Pausar');
    expect(wrapper.text()).toContain('Retomar');
    expect(wrapper.text()).toContain('Gerar agora');
    expect(wrapper.text()).toContain('Arquivar');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Pausar')!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Retomar')!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Gerar agora')!
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Arquivar')!
      .trigger('click');
    await flushPromises();
    const paths = vi.mocked(authenticatedFetch).mock.calls.map(([path]) => path);
    expect(paths).toContain('/recurrences/r1/pause');
    expect(paths).toContain('/recurrences/r2/resume');
    expect(paths).toContain('/recurrences/r1/generate');
    expect(paths).toContain('/recurrences/r1/archive');
  });
});
