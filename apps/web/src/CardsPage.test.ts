import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CardsPage from './pages/CardsPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('vue-router', () => ({ useRoute: () => ({ params: {} }) }));
import { authenticatedFetch } from './auth';
const response = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);
describe('CardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(
        String(path).includes('card-purchases') || String(path).includes('card-invoices')
          ? { items: [], nextCursor: null }
          : String(path).startsWith('/cards')
            ? { items: [] }
            : [],
      ),
    );
  });
  it('mostra estados vazios e não solicita PAN ou CVV', async () => {
    const w = mount(CardsPage);
    await vi.waitFor(() => expect(w.text()).toContain('Nenhum cartão'));
    expect(w.text()).toContain('Nenhuma compra');
    expect(w.text()).toContain('Nenhuma fatura');
    expect(w.text()).not.toContain('CVV');
    expect(w.text()).not.toContain('Número completo');
  });
  it('usa o filtro archived aprovado e paginação com limite padrão', async () => {
    mount(CardsPage);
    await vi.waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(5));
    expect(authenticatedFetch).toHaveBeenCalledWith('/cards?archived=true', undefined);
    expect(authenticatedFetch).toHaveBeenCalledWith('/card-purchases?limit=20', undefined);
    expect(authenticatedFetch).toHaveBeenCalledWith('/card-invoices?limit=20', undefined);
  });
  it('distingue API indisponível e oferece retry', async () => {
    vi.mocked(authenticatedFetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(() => response([]));
    const w = mount(CardsPage);
    await vi.waitFor(() => expect(w.text()).toContain('API indisponível'));
    expect(w.text()).toContain('Tentar novamente');
  });
});
