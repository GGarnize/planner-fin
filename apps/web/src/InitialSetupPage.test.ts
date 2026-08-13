import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import InitialSetupPage from './pages/InitialSetupPage.vue';

type MockDraft = {
  step: 'INTRO' | 'ACCOUNT' | 'CATEGORIES' | 'REVIEW';
  account: {
    name: string;
    type: string;
    openingBalance: string | null;
    openingBalanceDate: string;
  };
  categories: Array<{ key: string; name: string; type: string; icon: string; selected: boolean }>;
};
type MockPreview = {
  previewToken: string;
  draftVersion: number | null;
  summary: {
    account: MockDraft['account'] & { currency: string; institution: null };
    categories: Array<{ name: string; type: string; icon: string; color: null }>;
    counts: { accounts: number; categories: number; transactions: number; recurrences: number; total: number };
  };
};

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
  state: {
    data: {
      participating: true,
      eligible: true,
      status: 'NOT_STARTED',
      ineligibleReason: null,
      draft: null as MockDraft | null,
      draftVersion: null as number | null,
      suggestionVersion: 1,
      lastValidStep: 'INTRO',
      suggestions: [
        { key: 'income', name: 'Renda', type: 'INCOME', icon: 'WORK', selected: true },
        {
          key: 'food',
          name: 'Alimentacao',
          type: 'EXPENSE',
          icon: 'RESTAURANT',
          selected: true,
        },
      ],
    },
    loading: false,
    saving: false,
    error: '',
    preview: null as MockPreview | null,
  },
}));

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('./initial-setup', () => ({
  setupState: mocks.state,
  loadInitialSetup: mocks.load.mockResolvedValue(mocks.state.data),
  saveInitialSetupDraft: mocks.save.mockImplementation(async (draft) => {
    mocks.state.data = { ...mocks.state.data, draft, draftVersion: (mocks.state.data.draftVersion ?? 0) + 1 };
    return mocks.state.data;
  }),
  previewInitialSetup: mocks.preview.mockImplementation(async () => {
    const draft = mocks.state.data.draft;
    if (!draft) throw new Error('draft ausente');
    mocks.state.preview = {
      previewToken: 'preview',
      draftVersion: mocks.state.data.draftVersion,
      summary: {
        account: {
          name: draft.account.name,
          type: draft.account.type,
          currency: 'BRL',
          institution: null,
          openingBalance: draft.account.openingBalance ?? '0.00',
          openingBalanceDate: draft.account.openingBalanceDate,
        },
        categories: draft.categories
          .filter((item) => item.selected)
          .map((item) => ({ name: item.name, type: item.type, icon: item.icon, color: null })),
        counts: { accounts: 1, categories: 1, transactions: 0, recurrences: 0, total: 2 },
      },
    };
    return mocks.state.preview;
  }),
  confirmInitialSetup: mocks.confirm.mockResolvedValue(undefined),
}));

describe('InitialSetupPage', () => {
  it('salva draft no servidor, revisa saldo 0.00 e confirma explicitamente', async () => {
    const wrapper = mount(InitialSetupPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Setup inicial');
    await wrapper.get('section.panel button').trigger('click');
    await flushPromises();
    await wrapper.get('input').setValue('Conta principal');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ step: 'CATEGORIES' }));

    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(false);
    await wrapper.get('section.panel > button').trigger('click');
    await flushPromises();
    wrapper.vm.$forceUpdate();
    await flushPromises();

    expect(wrapper.text()).toContain('Saldo inicial: R$ 0,00');
    expect(wrapper.text()).toContain('Nenhum lancamento sera criado');

    await wrapper.get('section.panel button:last-child').trigger('click');
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith('/dashboard');
  });
});
