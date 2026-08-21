import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsPage from './pages/NotificationsPage.vue';

let mounted: VueWrapper[] = [];
afterEach(() => {
  mounted.forEach((wrapper) => wrapper.unmount());
  mounted = [];
});

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  isAndroid: vi.fn(),
  getStatus: vi.fn(),
  getCaptureState: vi.fn(),
  getObservedPackages: vi.fn(),
  ignoreObservedPackage: vi.fn(),
  restoreObservedPackage: vi.fn(),
  openSettings: vi.fn(),
  purgePendingQueue: vi.fn(),
  pushPreferences: vi.fn(),
  deleteAllHistory: vi.fn(),
}));

vi.mock('vue-router', async () => ({
  ...(await vi.importActual<typeof import('vue-router')>('vue-router')),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('./notification-listener', () => ({
  isNotificationListenerDiagnosticAvailable: mocks.isAndroid,
  getNotificationAccessStatus: mocks.getStatus,
  getCaptureState: mocks.getCaptureState,
  getObservedPackages: mocks.getObservedPackages,
  ignoreObservedPackage: mocks.ignoreObservedPackage,
  restoreObservedPackage: mocks.restoreObservedPackage,
  openNotificationAccessSettings: mocks.openSettings,
  purgePendingQueue: mocks.purgePendingQueue,
}));

vi.mock('./notification-sync', () => ({
  pushNotificationPreferences: mocks.pushPreferences,
}));

vi.mock('./notifications-api', () => ({
  notificationsApi: { deleteAllHistory: mocks.deleteAllHistory },
}));

const emptyCaptureState = (overrides: Partial<{ captureEnabled: boolean; monitoredPackages: string[] }> = {}) => ({
  captureEnabled: false,
  monitoredPackages: [],
  capturedCount: 0,
  secretDropped: 0,
  ...overrides,
});

function mountPage() {
  const wrapper = mount(NotificationsPage, { global: { stubs: { RouterLink: RouterLinkStub } } });
  mounted.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAndroid.mockReturnValue(true);
  mocks.getStatus.mockResolvedValue({ supported: true, granted: false });
  mocks.getCaptureState.mockResolvedValue(emptyCaptureState());
  mocks.getObservedPackages.mockResolvedValue([]);
  mocks.ignoreObservedPackage.mockResolvedValue([]);
  mocks.restoreObservedPackage.mockResolvedValue([]);
  mocks.pushPreferences.mockResolvedValue(undefined);
  mocks.purgePendingQueue.mockResolvedValue({ pendingCount: 0 });
});

describe('NotificationsPage — indisponibilidade no navegador', () => {
  it('mostra estado desabilitado sem chamar plugin/API quando fora do Android nativo', async () => {
    mocks.isAndroid.mockReturnValue(false);
    mocks.getStatus.mockResolvedValue({ supported: false, granted: false });
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Disponível no app Android');
    expect(mocks.openSettings).not.toHaveBeenCalled();
    expect(mocks.pushPreferences).not.toHaveBeenCalled();
  });
});

describe('NotificationsPage — sem acesso concedido', () => {
  it('mostra disclosure e CTA Ativar acesso / Agora não', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Acesso às notificações: Desativado');
    expect(wrapper.text()).toContain('Ativar acesso');
    expect(wrapper.text()).toContain('Agora não');
    expect(mocks.openSettings).not.toHaveBeenCalled();
  });

  it('mostra link real para a Política de Privacidade no disclosure', async () => {
    const wrapper = mountPage();
    await flushPromises();

    const link = wrapper
      .findAllComponents(RouterLinkStub)
      .find((candidate) => candidate.props('to') === '/privacy-policy');
    expect(link).toBeTruthy();
    expect(link!.text()).toContain('Política de Privacidade do PlannerFin');
  });

  it('só abre o Settings do Android após o gesto explícito no botão Ativar acesso', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(mocks.openSettings).not.toHaveBeenCalled();

    await wrapper.find('button.primary').trigger('click');

    expect(mocks.openSettings).toHaveBeenCalledTimes(1);
  });

  it('Agora não navega de volta sem abrir Settings', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const notNowButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Agora não')!;

    await notNowButton.trigger('click');

    expect(mocks.openSettings).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith('/mais');
  });

  it('ao retornar/resumir, consulta novamente o estado real', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('Ativar acesso');
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);

    mocks.getStatus.mockResolvedValue({ supported: true, granted: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('Acesso Android: Ativo');
  });
});

describe('NotificationsPage — acesso concedido', () => {
  beforeEach(() => {
    mocks.getStatus.mockResolvedValue({ supported: true, granted: true });
  });

  it('distingue permissionGranted, captureEnabled e monitoredPackages em linguagem de produto', async () => {
    mocks.getCaptureState.mockResolvedValue(
      emptyCaptureState({ captureEnabled: true, monitoredPackages: ['com.nu.production'] }),
    );
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Acesso Android: Ativo');
    expect(wrapper.text()).toContain('Ligada');
    expect(wrapper.text()).toContain('Apps monitorados');
    expect(wrapper.text()).toContain('1');
  });

  it('liga a captura chamando pushNotificationPreferences', async () => {
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find('button.primary').trigger('click');
    await flushPromises();

    expect(mocks.pushPreferences).toHaveBeenCalledWith({
      captureEnabled: true,
      monitoredPackages: [],
    });
  });

  it('desliga a captura preservando histórico por padrão', async () => {
    mocks.getCaptureState.mockResolvedValue(emptyCaptureState({ captureEnabled: true }));
    const wrapper = mountPage();
    await flushPromises();

    const desligar = wrapper.findAll('button').find((b) => b.text() === 'Desligar captura')!;
    await desligar.trigger('click');
    const desativar = wrapper.findAll('button').find((b) => b.text() === 'Desativar')!;
    await desativar.trigger('click');
    await flushPromises();

    expect(mocks.pushPreferences).toHaveBeenCalledWith({
      captureEnabled: false,
      monitoredPackages: [],
    });
    expect(mocks.deleteAllHistory).not.toHaveBeenCalled();
  });

  it('desliga e apaga histórico: desliga captura, purga fila nativa e só então apaga backend', async () => {
    mocks.getCaptureState.mockResolvedValue(emptyCaptureState({ captureEnabled: true }));
    mocks.deleteAllHistory.mockResolvedValue({ purgedCount: 3 });
    const order: string[] = [];
    mocks.pushPreferences.mockImplementation(async () => {
      order.push('pushPreferences');
    });
    mocks.purgePendingQueue.mockImplementation(async () => {
      order.push('purgePendingQueue');
      return { pendingCount: 0 };
    });
    mocks.deleteAllHistory.mockImplementation(async () => {
      order.push('deleteAllHistory');
      return { purgedCount: 3 };
    });
    const wrapper = mountPage();
    await flushPromises();

    const desligar = wrapper.findAll('button').find((b) => b.text() === 'Desligar captura')!;
    await desligar.trigger('click');
    const apagar = wrapper.findAll('button').find((b) => b.text() === 'Desativar e apagar histórico')!;
    await apagar.trigger('click');
    await flushPromises();

    expect(order).toEqual(['pushPreferences', 'purgePendingQueue', 'deleteAllHistory']);
    expect(wrapper.text()).toContain('Histórico apagado.');
  });

  it('desliga e apaga histórico: falha na purga da fila nativa não mostra sucesso e permite repetir', async () => {
    mocks.getCaptureState.mockResolvedValue(emptyCaptureState({ captureEnabled: true }));
    mocks.purgePendingQueue.mockRejectedValue(new Error('falha nativa'));
    const wrapper = mountPage();
    await flushPromises();

    const desligar = wrapper.findAll('button').find((b) => b.text() === 'Desligar captura')!;
    await desligar.trigger('click');
    const apagar = wrapper.findAll('button').find((b) => b.text() === 'Desativar e apagar histórico')!;
    await apagar.trigger('click');
    await flushPromises();

    expect(mocks.deleteAllHistory).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('Histórico apagado.');
    expect(wrapper.find('[role=alert]').exists()).toBe(true);
    expect(wrapper.findAll('button').find((b) => b.text() === 'Desativar e apagar histórico')).toBeTruthy();
  });

  it('gerencia apps sem textarea técnico e ativa cada app individualmente', async () => {
    const wrapper = mountPage();
    await flushPromises();

    const gerenciar = wrapper.findAll('button').find((b) => b.text() === 'Gerenciar apps')!;
    await gerenciar.trigger('click');

    expect(wrapper.find('textarea').exists()).toBe(false);
    const nubankToggle = wrapper.findAll('.choice').find((el) => el.text().includes('Nubank'))!;
    expect(nubankToggle.text()).toContain('com.nu.production');

    await nubankToggle.trigger('click');
    await flushPromises();

    expect(mocks.pushPreferences).toHaveBeenCalledWith({
      captureEnabled: false,
      monitoredPackages: ['com.nu.production'],
    });
  });

  it('nenhum app é ativado automaticamente ao abrir o gerenciador', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const gerenciar = wrapper.findAll('button').find((b) => b.text() === 'Gerenciar apps')!;
    await gerenciar.trigger('click');

    const pressed = wrapper.findAll('.choice[aria-pressed="true"]');
    expect(pressed).toHaveLength(0);
  });

  it('não usa terminologia de diagnóstico interno na UX final', async () => {
    const wrapper = mountPage();
    await flushPromises();
    const text = wrapper.text();
    expect(text).not.toContain('captureEnabled');
    expect(text).not.toContain('buffer');
    expect(text).not.toContain('secretDropped');
  });
});

describe('NotificationsPage — apps observados neste dispositivo', () => {
  beforeEach(() => {
    mocks.getStatus.mockResolvedValue({ supported: true, granted: true });
  });

  async function openManager(wrapper: VueWrapper) {
    const gerenciar = wrapper.findAll('button').find((b) => b.text() === 'Gerenciar apps')!;
    await gerenciar.trigger('click');
    await flushPromises();
  }

  it('mostra a seção Observados neste dispositivo com label, package e data', async () => {
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.UTC(2026, 0, 15) },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    expect(wrapper.text()).toContain('Observados neste dispositivo');
    const item = wrapper.findAll('.observed-choice').find((el) => el.text().includes('Caju'))!;
    expect(item.text()).toContain('com.example.caju');
    expect(item.text()).toContain('Visto em');
  });

  it('opt-in: tocar Monitorar adiciona o pacote observado a Monitorados', async () => {
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now() },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    const monitorar = wrapper.findAll('button').find((b) => b.text() === 'Monitorar')!;
    await monitorar.trigger('click');
    await flushPromises();

    expect(mocks.pushPreferences).toHaveBeenCalledWith({
      captureEnabled: false,
      monitoredPackages: ['com.example.caju'],
    });
  });

  it('Ignorar remove o app de Observados e mostra em Ignorados sem monitorar', async () => {
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now() },
    ]);
    mocks.ignoreObservedPackage.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now(), ignoredAt: Date.now() },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    const ignorar = wrapper.findAll('button').find((b) => b.text() === 'Ignorar')!;
    await ignorar.trigger('click');
    await flushPromises();

    expect(mocks.ignoreObservedPackage).toHaveBeenCalledWith('com.example.caju');
    expect(mocks.pushPreferences).not.toHaveBeenCalled();
    expect(wrapper.findAll('.observed-choice').filter((el) => el.text().includes('Monitorar'))).toHaveLength(0);
    expect(wrapper.text()).toContain('Ignorados (1)');
    expect(wrapper.text()).toContain('Voltar a mostrar');
  });

  it('permite voltar a mostrar um app ignorado', async () => {
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now(), ignoredAt: Date.now() },
    ]);
    mocks.restoreObservedPackage.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now(), ignoredAt: null },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    const restaurar = wrapper.findAll('button').find((b) => b.text() === 'Voltar a mostrar')!;
    await restaurar.trigger('click');
    await flushPromises();

    expect(mocks.restoreObservedPackage).toHaveBeenCalledWith('com.example.caju');
    expect(wrapper.text()).toContain('Monitorar');
    expect(wrapper.text()).not.toContain('Ignorados (1)');
  });

  it('app conhecido também observado aparece uma única vez (sem duplicar)', async () => {
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.nu.production', label: 'Nubank', lastSeenAt: Date.now() },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    const nubankEntries = wrapper
      .findAll('.choice, .observed-choice')
      .filter((el) => el.text().includes('Nubank'));
    expect(nubankEntries).toHaveLength(1);
    expect(wrapper.findAll('.observed-choice').some((el) => el.text().includes('Nubank'))).toBe(false);
  });

  it('app monitorado que também é conhecido aparece uma única vez (sem duplicar)', async () => {
    mocks.getCaptureState.mockResolvedValue(
      emptyCaptureState({ captureEnabled: true, monitoredPackages: ['com.nu.production'] }),
    );
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    const nubankEntries = wrapper
      .findAll('.choice, .observed-choice')
      .filter((el) => el.text().includes('Nubank'));
    expect(nubankEntries).toHaveLength(1);
    expect(nubankEntries[0]!.attributes('aria-pressed')).toBe('true');
  });

  it('app monitorado que também está observado aparece uma única vez (sem duplicar)', async () => {
    mocks.getCaptureState.mockResolvedValue(
      emptyCaptureState({ captureEnabled: true, monitoredPackages: ['com.example.caju'] }),
    );
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now() },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    const cajuEntries = wrapper
      .findAll('.choice, .observed-choice')
      .filter((el) => el.text().includes('Caju'));
    expect(cajuEntries).toHaveLength(1);
    expect(wrapper.findAll('.observed-choice').some((el) => el.text().includes('Caju'))).toBe(false);
  });

  it('busca filtra apps observados e conhecidos por nome ou package', async () => {
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now() },
      { packageName: 'com.example.alelo', label: 'Alelo', lastSeenAt: Date.now() },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    await wrapper.find('input[type="search"]').setValue('caju');
    await flushPromises();

    expect(wrapper.text()).toContain('Caju');
    expect(wrapper.text()).not.toContain('Alelo');
    expect(wrapper.text()).not.toContain('Nubank');
  });

  it('não lista automaticamente todos os apps instalados — apenas observados retornados pela bridge', async () => {
    mocks.getObservedPackages.mockResolvedValue([
      { packageName: 'com.example.caju', label: 'Caju', lastSeenAt: Date.now() },
    ]);
    const wrapper = mountPage();
    await flushPromises();
    await openManager(wrapper);

    expect(wrapper.findAll('.observed-choice')).toHaveLength(1);
  });
});
