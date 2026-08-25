import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoriesPage from './pages/CategoriesPage.vue';
vi.mock('./auth', () => ({ authenticatedFetch: vi.fn() }));
import { authenticatedFetch } from './auth';
const response = (data: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) } as Response);
const item = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Salário',
  type: 'INCOME',
  color: '#112233',
  icon: 'WORK',
  archivedAt: null,
  createdAt: '2026-08-07T00:00:00Z',
  updatedAt: '2026-08-07T00:00:00Z',
};
describe('tela de categorias (API mockada)', () => {
  beforeEach(() => vi.mocked(authenticatedFetch).mockReset());
  it('mostra estado vazio e criação', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([]));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link', 'q-icon'] } });
    await flushPromises();
    expect(w.text()).toContain('Nenhuma categoria encontrada');
  });
  it('mostra voltar como navegação secundária e mantém filtros alinhados', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([item]));
    const w = mount(CategoriesPage, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    });
    await flushPromises();
    const back = w.get('.account-back');
    expect(back.text()).toContain('Minha conta');
    expect(back.get('.material-icons').text()).toBe('arrow_back');
    const filters = w.get('.filters');
    expect(filters.get('.filter-field').text()).toContain('Natureza');
    expect(filters.get('select').element).toHaveProperty('value', '');
    expect(filters.get('.check').text()).toContain('Incluir arquivadas');
    expect(filters.find('input[type=checkbox]').exists()).toBe(true);
  });
  it('cria receita com cor e ícone fechados', async () => {
    vi.mocked(authenticatedFetch)
      .mockReturnValueOnce(response([]))
      .mockReturnValueOnce(response(item))
      .mockReturnValueOnce(response([item]));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link', 'q-icon'] } });
    await flushPromises();
    await w.findAll('button')[0]!.trigger('click');
    await w.get('input[maxlength="80"]').setValue('Salário');
    await w.findAll('select')[1]!.setValue('INCOME');
    await w.findAll('select')[2]!.setValue('WORK');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(
      JSON.parse(vi.mocked(authenticatedFetch).mock.calls[1]![1]!.body as string),
    ).toMatchObject({ name: 'Salário', type: 'INCOME', icon: 'WORK' });
  });
  it('mostra o ícone seguro junto do nome da categoria', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([item]));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link'] } });
    await flushPromises();
    const category = w.get('.category');
    expect(category.text()).toContain('Salário');
    expect(category.get('.material-icons').text()).toBe('work');
    expect(category.attributes('style')).toContain('border-color');
  });
  it('filtra arquivadas e natureza', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([]));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link', 'q-icon'] } });
    await flushPromises();
    await w.findAll('select')[0]!.setValue('EXPENSE');
    await w.get('input[type=checkbox]').setValue(true);
    await flushPromises();
    expect(vi.mocked(authenticatedFetch).mock.calls.at(-1)?.[0]).toContain('includeArchived=true');
    expect(vi.mocked(authenticatedFetch).mock.calls.at(-1)?.[0]).toContain('type=EXPENSE');
  });
  it('edita, arquiva e reativa sem oferecer edição arquivada', async () => {
    const archived = { ...item, archivedAt: '2026-08-07T01:00:00Z' };
    vi.mocked(authenticatedFetch).mockReturnValue(response([item]));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link', 'q-icon'] } });
    await flushPromises();
    await w.get('.kebab-trigger').trigger('click');
    expect(w.text()).toContain('Editar');
    expect(w.text()).toContain('Arquivar');
    vi.mocked(authenticatedFetch).mockReturnValue(response([archived]));
    await w
      .findAll('.kebab-panel button')
      .find((b) => b.text() === 'Arquivar')!
      .trigger('click');
    expect(w.get('.confirm-dialog').text()).toContain('Salário');
    await w.get('.confirm-dialog .danger').trigger('click');
    await flushPromises();
    expect(vi.mocked(authenticatedFetch).mock.calls.some((c) => c[0].endsWith('/archive'))).toBe(
      true,
    );
    expect(w.find('.confirm-dialog').exists()).toBe(false);
  });
  it('cancelar o diálogo de arquivamento não chama a API', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([item]));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link', 'q-icon'] } });
    await flushPromises();
    await w.get('.kebab-trigger').trigger('click');
    await w
      .findAll('.kebab-panel button')
      .find((b) => b.text() === 'Arquivar')!
      .trigger('click');
    await w.get('.confirm-dialog .secondary').trigger('click');
    expect(w.find('.confirm-dialog').exists()).toBe(false);
    expect(vi.mocked(authenticatedFetch).mock.calls.some((c) => c[0].endsWith('/archive'))).toBe(
      false,
    );
  });
  it('toque no item abre a edição diretamente', async () => {
    vi.mocked(authenticatedFetch).mockReturnValue(response([item]));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link', 'q-icon'] } });
    await flushPromises();
    await w.get('.entry-tap').trigger('click');
    expect((w.get('input[maxlength="80"]').element as HTMLInputElement).value).toBe('Salário');
  });
  it('informa API indisponível', async () => {
    vi.mocked(authenticatedFetch).mockRejectedValueOnce(new Error('offline'));
    const w = mount(CategoriesPage, { global: { stubs: ['router-link', 'q-icon'] } });
    await flushPromises();
    expect(w.get('[role=alert]').text()).toContain('API indisponível');
  });
});
