import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecurrencesPage from './pages/RecurrencesPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);
describe('RecurrencesPage', () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockImplementation((path) =>
      response(String(path).startsWith('/recurrences') ? [] : []),
    );
  });
  it('exibe loading e estado vazio, com criação semanal, mensal e anual', async () => {
    const w = mount(RecurrencesPage);
    expect(w.text()).toContain('Carregando');
    await vi.waitFor(() => expect(w.text()).toContain('Nenhuma recorrência'));
    expect(w.text()).toContain('Semanal');
    expect(w.text()).toContain('Mensal');
    expect(w.text()).toContain('Anual');
    expect(w.text()).toContain('Transferência');
  });
  it('informa indisponibilidade sem falso sucesso', async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error('offline'));
    const w = mount(RecurrencesPage);
    await vi.waitFor(() => expect(w.text()).toContain('API indisponível'));
    expect(w.text()).toContain('Tentar novamente');
  });
});
