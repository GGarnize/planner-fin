import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  native: false,
  platform: 'web',
  plugin: {
    getNotificationAccessStatus: vi.fn(),
    openNotificationAccessSettings: vi.fn(),
    setCaptureEnabled: vi.fn(),
    setMonitoredPackages: vi.fn(),
    getCaptureState: vi.fn(),
    getRecentCapturedNotifications: vi.fn(),
    clearRecentCapturedNotifications: vi.fn(),
    purgePendingQueue: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mocked.native,
    getPlatform: () => mocked.platform,
  },
  registerPlugin: () => mocked.plugin,
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));

describe('notification-listener bridge', () => {
  beforeEach(() => {
    mocked.native = false;
    mocked.platform = 'web';
    vi.resetModules();
    Object.values(mocked.plugin).forEach((fn) => fn.mockReset());
  });

  it('retorna indisponivel fora do Android nativo sem chamar plugin', async () => {
    const bridge = await import('./notification-listener');

    await expect(bridge.getNotificationAccessStatus()).resolves.toEqual({
      supported: false,
      granted: false,
    });
    await expect(bridge.getCaptureState()).resolves.toEqual({
      captureEnabled: false,
      monitoredPackages: [],
      capturedCount: 0,
      secretDropped: 0,
    });
    expect(mocked.plugin.getNotificationAccessStatus).not.toHaveBeenCalled();
  });

  it('encaminha estado e pacotes ao plugin no Android', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    mocked.plugin.setCaptureEnabled.mockResolvedValue({ captureEnabled: true });
    mocked.plugin.setMonitoredPackages.mockResolvedValue({
      captureEnabled: true,
      monitoredPackages: ['com.example.bank'],
    });
    const bridge = await import('./notification-listener');

    await bridge.setCaptureEnabled(true);
    await bridge.setMonitoredPackages(['com.example.bank']);

    expect(mocked.plugin.setCaptureEnabled).toHaveBeenCalledWith({ enabled: true });
    expect(mocked.plugin.setMonitoredPackages).toHaveBeenCalledWith({
      packages: ['com.example.bank'],
    });
  });

  it('purgePendingQueue e seguro fora do Android e nao chama o plugin', async () => {
    const bridge = await import('./notification-listener');

    await expect(bridge.purgePendingQueue()).resolves.toEqual({
      captureEnabled: false,
      monitoredPackages: [],
      capturedCount: 0,
      secretDropped: 0,
    });
    expect(mocked.plugin.purgePendingQueue).not.toHaveBeenCalled();
  });

  it('purgePendingQueue encaminha ao plugin no Android preservando o restante do estado', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    mocked.plugin.purgePendingQueue.mockResolvedValue({
      captureEnabled: true,
      monitoredPackages: ['com.nu.production'],
      pendingCount: 0,
    });
    const bridge = await import('./notification-listener');

    const result = await bridge.purgePendingQueue();

    expect(mocked.plugin.purgePendingQueue).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      captureEnabled: true,
      monitoredPackages: ['com.nu.production'],
      pendingCount: 0,
    });
  });
});
