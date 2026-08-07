import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import DebtsPage from './pages/DebtsPage.vue';
import { authenticatedFetch } from './auth';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
const response = (data: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => data }) as Response;
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/debts', component: DebtsPage },
      { path: '/debts/:id', component: DebtsPage },
    ],
  });
  await router.push('/debts');
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
    expect(w.findAll('select').length).toBeGreaterThanOrEqual(3);
    expect(w.text()).toContain('Carregar mais');
  });
});
