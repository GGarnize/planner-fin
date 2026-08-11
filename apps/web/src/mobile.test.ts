import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  native: false,
  platform: 'web',
  addListener: vi.fn(),
  exitApp: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mocked.native,
    getPlatform: () => mocked.platform,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mocked.addListener,
    exitApp: mocked.exitApp,
  },
}));

describe('runtime Android', () => {
  beforeEach(() => {
    mocked.native = false;
    mocked.platform = 'web';
    mocked.addListener.mockReset();
    mocked.exitApp.mockReset();
  });

  it('detecta Android nativo via API oficial do Capacitor', async () => {
    const { isAndroidNative } = await import('./mobile');
    expect(isAndroidNative()).toBe(false);
    mocked.native = true;
    mocked.platform = 'android';
    expect(isAndroidNative()).toBe(true);
  });

  it('não instala listener de Back no browser', async () => {
    const { installAndroidBackHandler } = await import('./mobile');
    installAndroidBackHandler({} as never);
    expect(mocked.addListener).not.toHaveBeenCalled();
  });

  it('volta no histórico SPA quando há rota útil', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    const router = {
      currentRoute: { value: { path: '/cards' } },
      back: vi.fn(),
    };
    const { installAndroidBackHandler } = await import('./mobile');
    installAndroidBackHandler(router as never);
    const handler = mocked.addListener.mock.calls[0][1];
    handler({ canGoBack: true });
    expect(router.back).toHaveBeenCalled();
    expect(mocked.exitApp).not.toHaveBeenCalled();
  });

  it.each(['/', '/dashboard'])(
    'sai na raiz Android %s mesmo com histórico da WebView',
    async (path) => {
      mocked.native = true;
      mocked.platform = 'android';
      const router = {
        currentRoute: { value: { path } },
        back: vi.fn(),
      };
      const { installAndroidBackHandler } = await import('./mobile');
      installAndroidBackHandler(router as never);
      const handler = mocked.addListener.mock.calls[0][1];

      handler({ canGoBack: true });

      expect(router.back).not.toHaveBeenCalled();
      expect(mocked.exitApp).toHaveBeenCalledTimes(1);
    },
  );
});
