import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransfersPage from './pages/TransfersPage.vue';

vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));

let routeLeaveGuard: ((to: { fullPath: string }) => boolean) | undefined;
const routerPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
  onBeforeRouteLeave: (guard: typeof routeLeaveGuard) => {
    routeLeaveGuard = guard;
  },
}));

import { authenticatedFetch } from './auth';

async function openTransferForm(wrapper: VueWrapper) {
  await wrapper
    .findAll('button')
    .find(
      (button) => button.text() === 'Nova transferencia' || button.text() === 'Nova transferência',
    )!
    .trigger('click');
  await wrapper.vm.$nextTick();
}

const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) } as Response);

const accounts = [
  { id: 'a', name: 'Origem', archivedAt: null },
  { id: 'b', name: 'Destino', archivedAt: null },
] as never;

const empty = { data: [], page: { limit: 20, nextCursor: null } };
const transfer = {
  id: 't',
  sourceAccountId: 'a',
  destinationAccountId: 'b',
  status: 'PENDING',
  description: 'Reserva',
  notes: null,
  plannedAmount: '10.00',
  actualAmount: null,
  dueDate: '2026-08-01',
  completedAt: null,
  isOverdue: true,
  createdAt: 'x',
  updatedAt: 'x',
};

function mockList(data: unknown = empty) {
  vi.mocked(authenticatedFetch).mockImplementation((path) =>
    response(String(path).startsWith('/transfers?') ? data : accounts),
  );
}

describe('tela de transferencias', () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
    routerPush.mockReset();
    routeLeaveGuard = undefined;
  });

  it('mostra lista inicial vazia e formulario sem categoria', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.text()).toContain('Nenhuma transferência cadastrada');
    await openTransferForm(w);
    expect(w.text()).toContain('Origem');
    expect(w.text()).toContain('Destino');
    expect(w.text()).not.toContain('Categoria');
    w.unmount();
  });

  it('exclui origem do destino e cria concluida com strings', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await openTransferForm(w);
    let selects = w.findAll('.modal select');
    await selects[0]!.setValue('a');
    await w.vm.$nextTick();
    selects = w.findAll('.modal select');
    expect(selects[1]!.findAll('option').some((o) => o.attributes('value') === 'a')).toBe(false);
    await selects[1]!.setValue('b');
    await w.get('input[maxlength="200"]').setValue('Reserva');
    const decimals = w.findAll('input[inputmode="decimal"]');
    await decimals[0]!.setValue('10.00');
    await w.get('.modal input[type="date"]').setValue('2026-08-08');
    await selects[2]!.setValue('COMPLETED');
    await flushPromises();
    const allDecimals = w.findAll('input[inputmode="decimal"]');
    await allDecimals[1]!.setValue('10.00');
    const dates = w.findAll('.modal input[type="date"]');
    await dates[1]!.setValue('2026-08-08');
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    const call = vi.mocked(authenticatedFetch).mock.calls.find((c) => c[1]?.method === 'POST')!;
    const body = JSON.parse(call[1]!.body as string);
    expect(typeof body.plannedAmount).toBe('string');
    expect(body.status).toBe('COMPLETED');
    w.unmount();
  });

  it('cria pendente normalizando valor inteiro para decimal canonico', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await openTransferForm(w);
    let selects = w.findAll('.modal select');
    await selects[0]!.setValue('a');
    await w.vm.$nextTick();
    selects = w.findAll('.modal select');
    await selects[1]!.setValue('b');
    await w.get('input[maxlength="200"]').setValue('Reserva');
    await w.get('input[inputmode="decimal"]').setValue('2300');
    await w.get('.modal input[type="date"]').setValue('2026-08-08');
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    const call = vi.mocked(authenticatedFetch).mock.calls.find((c) => c[1]?.method === 'POST')!;
    const body = JSON.parse(call[1]!.body as string);
    expect(body.plannedAmount).toBe('2300.00');
    expect(body).not.toHaveProperty('actualAmount');
    expect(body).not.toHaveProperty('completedAt');
    w.unmount();
  });

  it('mostra vencimento como tipo de periodo padrao e abre filtros secundarios sob demanda', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.find('#transfer-secondary-filters').attributes('style')).toContain('display: none');
    expect(w.text()).toContain('Filtrar data por');
    expect(w.text()).toContain('Período');
    expect(w.findAll('.date-period input[type="date"]')).toHaveLength(2);
    expect((w.get('.date-filter-type select').element as HTMLSelectElement).value).toBe('dueDate');
    expect(w.text()).not.toContain('Conclusão inicial');
    expect(w.text()).toContain('Mais filtros');
    await w.get('button[aria-controls="transfer-secondary-filters"]').trigger('click');
    await w.vm.$nextTick();
    expect(w.find('#transfer-secondary-filters').attributes('style') ?? '').not.toContain(
      'display: none',
    );
    expect(w.text()).toContain('Conta participante');
    w.unmount();
  });

  it('aplica, indica, preserva combinacao e limpa filtros', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await w.get('.date-period input[type="date"]').setValue('2026-08-01');
    await w.get('button[aria-controls="transfer-secondary-filters"]').trigger('click');
    await w.find('#transfer-secondary-filters select').setValue('a');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Aplicar')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).toContain('2 filtros ativos');
    expect((w.find('#transfer-secondary-filters select').element as HTMLSelectElement).value).toBe(
      'a',
    );
    expect(
      vi
        .mocked(authenticatedFetch)
        .mock.calls.some((call) => String(call[0]).includes('dueDateFrom=2026-08-01')),
    ).toBe(true);
    expect(
      vi
        .mocked(authenticatedFetch)
        .mock.calls.some((call) => String(call[0]).includes('sourceAccountId=a')),
    ).toBe(true);
    await w
      .findAll('button')
      .find((b) => b.text() === 'Limpar filtros')!
      .trigger('click');
    await flushPromises();
    expect(w.text()).not.toContain('filtros ativos');
    expect((w.get('.date-period input[type="date"]').element as HTMLInputElement).value).toBe('');
    expect((w.get('.date-filter-type select').element as HTMLSelectElement).value).toBe('dueDate');
    w.unmount();
  });

  it('alterna periodo para conclusao sem manter vencimento oculto ativo', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    const dueInputs = w.findAll('.date-period input[type="date"]');
    await dueInputs[0]!.setValue('2026-08-01');
    await dueInputs[1]!.setValue('2026-08-31');

    await w.get('.date-filter-type select').setValue('completedAt');
    await w.vm.$nextTick();
    expect(w.findAll('.date-period input[type="date"]')).toHaveLength(2);
    expect(
      vi
        .mocked(authenticatedFetch)
        .mock.calls.some((call) => String(call[0]).includes('dueDateFrom=2026-08-01')),
    ).toBe(false);

    const completedInputs = w.findAll('.date-period input[type="date"]');
    await completedInputs[0]!.setValue('2026-09-01');
    await completedInputs[1]!.setValue('2026-09-30');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Aplicar')!
      .trigger('click');
    await flushPromises();

    const listCalls = vi.mocked(authenticatedFetch).mock.calls.map((call) => String(call[0]));
    expect(listCalls.some((url) => url.includes('completedAtFrom=2026-09-01'))).toBe(true);
    expect(listCalls.some((url) => url.includes('completedAtTo=2026-09-30'))).toBe(true);
    expect(listCalls.some((url) => url.includes('dueDateFrom=2026-08-01'))).toBe(false);
    expect(w.text()).toContain('2 filtros ativos');
    w.unmount();
  });

  it('abre edicao em superficie dedicada', async () => {
    mockList({ data: [transfer], page: { limit: 20, nextCursor: null } });
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Editar')!
      .trigger('click');
    expect(w.get('[role="dialog"]').text()).toContain('Editar');
    expect((w.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('Reserva');
    w.unmount();
  });

  it('mantem dados preenchidos apos erro de validacao e de API', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path, init) => {
      if (init?.method === 'POST')
        return response({ error: { message: 'Falha sintetica ao salvar.' } }, false);
      return response(String(path).startsWith('/transfers?') ? empty : accounts);
    });
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await openTransferForm(w);
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    expect(w.text()).toContain('Selecione a conta de origem');
    let selects = w.findAll('.modal select');
    await selects[0]!.setValue('a');
    await w.vm.$nextTick();
    selects = w.findAll('.modal select');
    await selects[1]!.setValue('b');
    await w.get('input[maxlength="200"]').setValue('Reserva preservada');
    await w.get('input[inputmode="decimal"]').setValue('99');
    await w.get('.modal input[type="date"]').setValue('2026-08-08');
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    expect(w.get('[role=alert]').text()).toContain('Falha sintetica');
    expect((w.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe(
      'Reserva preservada',
    );
    w.unmount();
  });

  it('protege rascunho no cancelar e permite descartar', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await openTransferForm(w);
    await w.get('input[maxlength="200"]').setValue('Rascunho');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Cancelar')!
      .trigger('click');
    expect(w.get('[aria-label="Descartar alteracoes"]').text()).toContain('Descartar');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Continuar editando')!
      .trigger('click');
    expect((w.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('Rascunho');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Voltar')!
      .trigger('click');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Descartar')!
      .trigger('click');
    await flushPromises();
    expect(w.find('.modal').exists()).toBe(false);
    w.unmount();
  });

  it('back limpo fecha direto e back sujo pede confirmacao', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await openTransferForm(w);
    const cleanBack = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(cleanBack);
    await flushPromises();
    expect(cleanBack.defaultPrevented).toBe(true);
    expect(w.find('.modal').exists()).toBe(false);

    await openTransferForm(w);
    await w.get('input[maxlength="200"]').setValue('Rascunho');
    const dirtyBack = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(dirtyBack);
    await flushPromises();
    expect(dirtyBack.defaultPrevented).toBe(true);
    expect(w.get('[aria-label="Descartar alteracoes"]').text()).toContain('Continuar editando');
    expect((w.get('input[maxlength="200"]').element as HTMLInputElement).value).toBe('Rascunho');
    w.unmount();
  });

  it('guarda navegacao de rota com rascunho sujo', async () => {
    mockList();
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await openTransferForm(w);
    await w.get('input[maxlength="200"]').setValue('Rascunho de rota');
    expect(routeLeaveGuard?.({ fullPath: '/accounts' })).toBe(false);
    await w.vm.$nextTick();
    await w
      .findAll('button')
      .find((b) => b.text() === 'Descartar')!
      .trigger('click');
    await flushPromises();
    expect(routerPush).toHaveBeenCalledWith('/accounts');
    w.unmount();
  });

  it('bloqueia scroll de fundo enquanto modal esta aberto e libera ao fechar', async () => {
    mockList();
    document.body.style.overflow = '';
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    await openTransferForm(w);
    await flushPromises();
    expect(document.body.style.overflow).toBe('hidden');
    const back = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(back);
    await flushPromises();
    expect(back.defaultPrevented).toBe(true);
    expect(document.body.style.overflow).toBe('');
    expect(w.find('.modal').exists()).toBe(false);
    w.unmount();
  });

  it('mostra vencida, conclui, reabre e pagina', async () => {
    mockList({ data: [transfer], page: { limit: 20, nextCursor: 'cursor' } });
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.text()).toContain('Vencida');
    await w
      .findAll('button')
      .find((b) => b.text() === 'Concluir')!
      .trigger('click');
    await w.get('.modal form').trigger('submit');
    await flushPromises();
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some((c) => String(c[0]).endsWith('/complete')),
    ).toBe(true);
    await w
      .findAll('button')
      .find((b) => b.text() === 'Carregar mais')!
      .trigger('click');
    expect(
      vi.mocked(authenticatedFetch).mock.calls.some((c) => String(c[0]).includes('cursor=cursor')),
    ).toBe(true);
    w.unmount();
  });

  it('informa API indisponivel', async () => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      String(path).startsWith('/transfers?')
        ? Promise.reject(new Error('offline'))
        : response(accounts),
    );
    const w = mount(TransfersPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    expect(w.get('[role=alert]').text()).toContain('API indispon');
    w.unmount();
  });
});
