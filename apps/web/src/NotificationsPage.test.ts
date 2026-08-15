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
  openSettings: vi.fn(),
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
  openNotificationAccessSettings: mocks.openSettings,
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
  mocks.pushPreferences.mockResolvedValue(undefined);
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

  it('desliga e apaga histórico quando escolhido explicitamente', async () => {
    mocks.getCaptureState.mockResolvedValue(emptyCaptureState({ captureEnabled: true }));
    mocks.deleteAllHistory.mockResolvedValue({ purgedCount: 3 });
    const wrapper = mountPage();
    await flushPromises();

    const desligar = wrapper.findAll('button').find((b) => b.text() === 'Desligar captura')!;
    await desligar.trigger('click');
    const apagar = wrapper.findAll('button').find((b) => b.text() === 'Desativar e apagar histórico')!;
    await apagar.trigger('click');
    await flushPromises();

    expect(mocks.deleteAllHistory).toHaveBeenCalledTimes(1);
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
