import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsInboxPage from './pages/NotificationsInboxPage.vue';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  confirm: vi.fn(),
  dismiss: vi.fn(),
  markNonFinancial: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('./notifications-api', () => ({
  notificationsApi: {
    list: mocks.list,
    get: mocks.get,
    confirm: mocks.confirm,
    dismiss: mocks.dismiss,
    markNonFinancial: mocks.markNonFinancial,
  },
}));
vi.mock('./auth', () => ({ authenticatedFetch: mocks.fetch }));

const account = { id: 'acc-1', name: 'Conta Corrente', archivedAt: null };
const expenseCategory = { id: 'cat-expense', name: 'Alimentação', type: 'EXPENSE', archivedAt: null };

function notification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'n1',
    deviceId: 'device-1',
    packageName: 'com.nu.production',
    status: 'FINANCIAL_CANDIDATE',
    postedAt: '2026-08-13T19:31:00.000Z',
    receivedAt: '2026-08-13T19:31:05.000Z',
    title: 'Compra aprovada',
    text: 'Compra de R$ 42,90 em PADARIA EXEMPLO',
    subText: null,
    bigText: null,
    parsedType: 'EXPENSE',
    parsedAmount: '42.90',
    parsedDescription: 'Compra aprovada',
    classificationReasons: ['valor_detectado'],
    classifiedAt: '2026-08-13T19:31:05.000Z',
    accountId: null,
    categoryId: null,
    confirmedTransactionId: null,
    confirmedAt: null,
    dismissedAt: null,
    createdAt: '2026-08-13T19:31:05.000Z',
    updatedAt: '2026-08-13T19:31:05.000Z',
    ...overrides,
  };
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/notifications/inbox', component: NotificationsInboxPage },
      { path: '/notifications/inbox/:id', component: NotificationsInboxPage },
    ],
  });
}

async function mountAt(router: Router, path: string) {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(NotificationsInboxPage, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockImplementation((path: string) =>
    Promise.resolve(
      new Response(JSON.stringify(path === '/accounts' ? [account] : [expenseCategory]), {
        status: 200,
      }),
    ),
  );
});

describe('NotificationsInboxPage — lista atualiza ao voltar de uma ação', () => {
  it('remove o item da lista após confirmar e voltar', async () => {
    const router = makeRouter();
    mocks.get.mockResolvedValue(notification());
    mocks.confirm.mockResolvedValue(notification({ status: 'CONFIRMED', confirmedTransactionId: 't1' }));
    const wrapper = await mountAt(router, '/notifications/inbox/n1');

    await wrapper.findAll('select')[1]!.setValue('acc-1');
    await wrapper.findAll('select')[2]!.setValue('cat-expense');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    mocks.list.mockResolvedValueOnce({ data: [], page: { limit: 20, offset: 0, filteredCount: 0 } });
    await router.push('/notifications/inbox');
    await flushPromises();

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Nenhuma notificação para revisar');
  });

  it('remove o item da lista após descartar e voltar', async () => {
    const router = makeRouter();
    mocks.get.mockResolvedValue(notification());
    mocks.dismiss.mockResolvedValue(notification({ status: 'DISMISSED', dismissedAt: '2026-08-13T20:00:00.000Z' }));
    const wrapper = await mountAt(router, '/notifications/inbox/n1');

    const descartar = wrapper.findAll('button').find((b) => b.text() === 'Descartar')!;
    await descartar.trigger('click');
    await flushPromises();

    mocks.list.mockResolvedValueOnce({ data: [], page: { limit: 20, offset: 0, filteredCount: 0 } });
    await router.push('/notifications/inbox');
    await flushPromises();

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Nenhuma notificação para revisar');
  });

  it('remove o item da lista após marcar como não financeira e voltar', async () => {
    const router = makeRouter();
    mocks.get.mockResolvedValue(notification());
    mocks.markNonFinancial.mockResolvedValue(notification({ status: 'NON_FINANCIAL' }));
    const wrapper = await mountAt(router, '/notifications/inbox/n1');

    const marcar = wrapper.findAll('button').find((b) => b.text() === 'Marcar como não financeira')!;
    await marcar.trigger('click');
    await flushPromises();

    mocks.list.mockResolvedValueOnce({ data: [], page: { limit: 20, offset: 0, filteredCount: 0 } });
    await router.push('/notifications/inbox');
    await flushPromises();

    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Nenhuma notificação para revisar');
  });

  it('erro ao carregar contas/categorias vira mensagem controlada, sem travar a tela', async () => {
    const router = makeRouter();
    mocks.get.mockResolvedValue(notification());
    mocks.fetch.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/accounts'
          ? new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Falhou' } }), {
              status: 500,
            })
          : new Response(JSON.stringify([expenseCategory]), { status: 200 }),
      ),
    );
    const wrapper = await mountAt(router, '/notifications/inbox/n1');

    expect(wrapper.get('[role=alert]').text()).toContain(
      'Não foi possível carregar esta notificação agora.',
    );
    expect(wrapper.find('form').exists()).toBe(false);
  });
});
