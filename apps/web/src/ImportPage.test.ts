import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImportPage from './pages/ImportPage.vue';

const mocks = vi.hoisted(() => ({
  android: false,
  route: { params: {} as Record<string, string> },
  replace: vi.fn(),
  upload: vi.fn(),
  get: vi.fn(),
  mapping: vi.fn(),
  patchRow: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  listOpen: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('vue-router', async () => ({
  ...(await vi.importActual<typeof import('vue-router')>('vue-router')),
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('./import-api', async () => {
  const actual = await vi.importActual<typeof import('./import-api')>('./import-api');
  return {
    ...actual,
    importApi: {
      upload: mocks.upload,
      get: mocks.get,
      mapping: mocks.mapping,
      patchRow: mocks.patchRow,
      preview: mocks.preview,
      confirm: mocks.confirm,
      cancel: mocks.cancel,
      listOpen: mocks.listOpen,
    },
  };
});
vi.mock('./auth', () => ({ authenticatedFetch: mocks.fetch }));
vi.mock('./mobile', () => ({
  importStatementFileAccept: () =>
    mocks.android
      ? '.ofx,.csv,text/csv,application/x-ofx,text/plain,application/octet-stream'
      : '.ofx,.csv,text/csv,application/x-ofx',
}));

const account = { id: 'a', name: 'Conta teste', currency: 'BRL', archivedAt: null };
const categories = [
  { id: 'ce', name: 'Alimentação', type: 'EXPENSE', archivedAt: null },
  { id: 'ci', name: 'Salário', type: 'INCOME', archivedAt: null },
];
const row = (duplicateClassification = 'NONE') => ({
  id: 'r1',
  rowNumber: 1,
  date: '2026-08-01',
  description: 'mercado',
  type: 'EXPENSE',
  amount: '25.00',
  categoryId: null,
  selected: duplicateClassification === 'NONE',
  validationStatus: duplicateClassification === 'STRONG' ? 'BLOCKED' : 'VALID',
  warnings: [],
  duplicateClassification,
  probableOverride: false,
  possibleAccepted: false,
});
const session = (status = 'READY_FOR_REVIEW', rows = [row()]) => ({
  id: 's1',
  accountId: 'a',
  format: 'CSV',
  status,
  draftVersion: 1,
  displayFileName: 'extrato.csv',
  rowCount: rows.length,
  expiresAt: '2026-08-20T00:00:00Z',
  mapping: null,
  rows,
  page: { limit: 100, offset: 0, filteredCount: rows.length },
});
const mountPage = () => mount(ImportPage, { global: { stubs: { RouterLink: RouterLinkStub } } });
const chooseSyntheticFile = async (wrapper: ReturnType<typeof mountPage>, file: File) => {
  Object.defineProperty(wrapper.find('input[type=file]').element, 'files', {
    value: [file],
    configurable: true,
  });
  await wrapper.find('input[type=file]').trigger('change');
};
const submitUpload = async (wrapper: ReturnType<typeof mountPage>) => {
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Enviar arquivo')!
    .trigger('click');
  await flushPromises();
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.android = false;
  mocks.route.params = {};
  mocks.listOpen.mockResolvedValue([]);
  mocks.fetch.mockImplementation((path: string) =>
    Promise.resolve(
      new Response(JSON.stringify(path === '/accounts' ? [account] : categories), { status: 200 }),
    ),
  );
});

describe('ImportPage', () => {
  it('oferece upload explícito OFX/CSV, conta e limites sem gravar draft em storage', async () => {
    const setLocal = vi.spyOn(Storage.prototype, 'setItem');
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('máximo de 10 MiB e 10.000 linhas');
    expect(wrapper.find('input[type=file]').attributes('accept')).toBe(
      '.ofx,.csv,text/csv,application/x-ofx',
    );
    const file = new File(['OFXHEADER'], 'teste.ofx', { type: 'application/x-ofx' });
    await chooseSyntheticFile(wrapper, file);
    mocks.upload.mockResolvedValue(session());
    await submitUpload(wrapper);
    expect(mocks.upload).toHaveBeenCalledWith(file, 'a', 'OFX', ',');
    expect(setLocal).not.toHaveBeenCalled();
  });

  it('amplia o accept somente no Android nativo para providers OFX genericos', async () => {
    mocks.android = true;
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find('input[type=file]').attributes('accept')).toBe(
      '.ofx,.csv,text/csv,application/x-ofx,text/plain,application/octet-stream',
    );
  });

  it.each([
    ['extrato.ofx', 'OFX'],
    ['extrato.OFX', 'OFX'],
    ['extrato.csv', 'CSV'],
  ] as const)('detecta %s como %s antes do upload', async (name, detectedFormat) => {
    const wrapper = mountPage();
    await flushPromises();
    const file = new File(['conteudo'], name, { type: 'text/plain' });
    await chooseSyntheticFile(wrapper, file);
    expect(wrapper.text()).toContain(`Formato detectado: ${detectedFormat}`);
    mocks.upload.mockResolvedValue(session('READY_FOR_REVIEW', []));
    await submitUpload(wrapper);
    expect(mocks.upload).toHaveBeenCalledWith(file, 'a', detectedFormat, ',');
  });

  it('rejeita extensao invalida mesmo quando o picker Android aceita MIME generico', async () => {
    mocks.android = true;
    const wrapper = mountPage();
    await flushPromises();
    await chooseSyntheticFile(wrapper, new File(['texto'], 'extrato.txt', { type: 'text/plain' }));
    await submitUpload(wrapper);
    expect(wrapper.text()).toContain('Use somente arquivos OFX ou CSV.');
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejeita arquivo acima de 10 MiB antes de chamar a API', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const file = new File(['OFXHEADER'], 'grande.ofx', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
    await chooseSyntheticFile(wrapper, file);
    await submitUpload(wrapper);
    expect(wrapper.text()).toContain('O arquivo excede o limite de 10 MiB.');
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('mapeia CSV com headers, amostras e fallback sem header', async () => {
    mocks.route.params = { id: 's1' };
    mocks.get.mockResolvedValue({
      ...session('MAPPING_REQUIRED', []),
      csvSample: {
        columns: [
          { index: 0, header: 'Data', samples: ['01/08/2026'] },
          { index: 1, header: '', samples: ['SUPERMERCADO'] },
          { index: 2, header: 'Valor', samples: ['’ -25,00'.replace(' ', '')] },
        ],
        rowCount: 1,
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('Data — ex.: 01/08/2026');
    expect(wrapper.text()).toContain('Coluna 2 — ex.: SUPERMERCADO');
    mocks.mapping.mockResolvedValue(session());
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Aplicar mapping'))!
      .trigger('click');
    await flushPromises();
    expect(mocks.mapping).toHaveBeenCalledWith(
      's1',
      1,
      expect.objectContaining({
        version: 1,
        columns: expect.objectContaining({ date: 0, description: 1, amount: 2 }),
      }),
    );
  });

  it('lista drafts, mantém nova importação e continua somente após ação explícita', async () => {
    mocks.listOpen.mockResolvedValue([
      {
        id: 's1',
        accountId: 'a',
        format: 'CSV',
        status: 'MAPPING_REQUIRED',
        displayFileName: 'extrato-agosto.csv',
        draftVersion: 1,
        updatedAt: new Date().toISOString(),
        expiresAt: '2099-01-01T00:00:00Z',
      },
    ]);
    mocks.get.mockResolvedValue(session('MAPPING_REQUIRED', []));
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('Importação em andamento');
    expect(wrapper.text()).toContain('extrato-agosto.csv');
    expect(wrapper.text()).toContain('Nova importação');
    expect(mocks.get).not.toHaveBeenCalled();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Continuar')!
      .trigger('click');
    await flushPromises();
    expect(mocks.get).toHaveBeenCalledWith('s1', 'all');
    expect(mocks.replace).toHaveBeenCalledWith('/imports/s1');
  });

  it.each([
    ['STRONG', 'sem override'],
    ['PROBABLE', 'aceite individual'],
    ['POSSIBLE', 'aceite explícito'],
  ])('explica duplicidade %s', async (kind, text) => {
    mocks.route.params = { id: 's1' };
    mocks.get.mockResolvedValue(session('READY_FOR_REVIEW', [row(kind)]));
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain(text);
    await wrapper.find('article button').trigger('click');
    if (kind === 'STRONG')
      expect(wrapper.find('input[type=checkbox]').attributes('disabled')).toBeDefined();
  });

  it('filtra sem alterar seleção, revisa categoria e desmarca linha', async () => {
    mocks.route.params = { id: 's1' };
    mocks.get.mockResolvedValue(session());
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.findAll('.chips button')[2]!.trigger('click');
    await flushPromises();
    expect(mocks.get).toHaveBeenLastCalledWith('s1', 'warning', 0);
    await wrapper.find('article button').trigger('click');
    const checkbox = wrapper.find('.dialog input[type=checkbox]');
    await checkbox.setValue(false);
    await wrapper.find('.dialog select').setValue('EXPENSE');
    await wrapper.findAll('.dialog select')[1]!.setValue('ce');
    mocks.patchRow.mockResolvedValue(session());
    await wrapper.find('form.dialog').trigger('submit');
    await flushPromises();
    expect(mocks.patchRow).toHaveBeenCalledWith(
      's1',
      'r1',
      expect.objectContaining({ selected: false, categoryId: 'ce' }),
    );
  });

  it('gera preview e reutiliza a mesma chave idempotente no retry', async () => {
    mocks.route.params = { id: 's1' };
    mocks.get.mockResolvedValue(session());
    mocks.preview.mockResolvedValue({
      previewToken: 'p',
      draftVersion: 1,
      counts: { total: 1, selected: 1, blocked: 0, strong: 0, probable: 0, possible: 0 },
      totals: { income: '0.00', expense: '25.00' },
    });
    mocks.confirm
      .mockRejectedValueOnce(new Error('API indisponível'))
      .mockResolvedValueOnce({
        status: 'CONFIRMED',
        sessionId: 's1',
        transactionIds: ['t1'],
        createdCount: 1,
      });
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Revisar resumo')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Saldo líquido');
    const confirm = () =>
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('Importar 1'))!
        .trigger('click');
    await confirm();
    await flushPromises();
    await confirm();
    await flushPromises();
    expect(mocks.confirm.mock.calls[0]![3]).toBe(mocks.confirm.mock.calls[1]![3]);
    expect(wrapper.text()).toContain('Importação concluída');
  });

  it('cancela pela API e Escape fecha a edição antes da tela', async () => {
    mocks.route.params = { id: 's1' };
    mocks.get.mockResolvedValue(session());
    mocks.cancel.mockResolvedValue(undefined);
    const wrapper = mountPage();
    await flushPromises();
    await wrapper.find('article button').trigger('click');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('.dialog').exists()).toBe(false);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Cancelar importação')!
      .trigger('click');
    await wrapper
      .findAll('.dialog button')
      .find((button) => button.text() === 'Cancelar importação')!
      .trigger('click');
    await flushPromises();
    expect(mocks.cancel).toHaveBeenCalledWith('s1', 1);
    expect(mocks.replace).toHaveBeenCalledWith('/mais');
  });
});
