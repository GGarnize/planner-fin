import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  native: false,
  platform: 'web',
  flush: vi.fn(),
  addListener: vi.fn(),
  exitApp: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mocked.native,
    getPlatform: () => mocked.platform,
  },
  registerPlugin: () => ({ flush: mocked.flush }),
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
    mocked.flush.mockReset();
    mocked.addListener.mockReset();
    mocked.exitApp.mockReset();
    (
      globalThis as typeof globalThis & { __plannerfinSuppressNextAndroidBack?: number }
    ).__plannerfinSuppressNextAndroidBack = 0;
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

  it('nao aciona plugin de cookies no browser', async () => {
    const { flushAndroidCookies } = await import('./mobile');
    await flushAndroidCookies();
    expect(mocked.flush).not.toHaveBeenCalled();
  });

  it('aciona flush de cookies no Android nativo', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    const { flushAndroidCookies } = await import('./mobile');
    await flushAndroidCookies();
    expect(mocked.flush).toHaveBeenCalledTimes(1);
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

  it('não navega quando uma tela consome o Back Android', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    const router = {
      currentRoute: { value: { path: '/recurrences' } },
      back: vi.fn(),
    };
    const listener = (event: Event) => event.preventDefault();
    window.addEventListener('plannerfin:android-back', listener);
    const { installAndroidBackHandler } = await import('./mobile');
    installAndroidBackHandler(router as never);
    const handler = mocked.addListener.mock.calls[0][1];

    handler({ canGoBack: true });

    expect(router.back).not.toHaveBeenCalled();
    expect(mocked.exitApp).not.toHaveBeenCalled();
    window.removeEventListener('plannerfin:android-back', listener);
  });

  it('trata fechamento de diálogo como Back consumido no WebView Android', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    document.body.innerHTML = '<div class="backdrop"><section role="dialog"></section></div>';
    const router = {
      currentRoute: { value: { path: '/recurrences' } },
      back: vi.fn(),
    };
    const listener = () => document.querySelector('.backdrop')?.remove();
    window.addEventListener('plannerfin:android-back', listener);
    const { installAndroidBackHandler } = await import('./mobile');
    installAndroidBackHandler(router as never);
    const handler = mocked.addListener.mock.calls[0][1];

    handler({ canGoBack: true });

    expect(router.back).not.toHaveBeenCalled();
    expect(mocked.exitApp).not.toHaveBeenCalled();
    window.removeEventListener('plannerfin:android-back', listener);
    document.body.innerHTML = '';
  });

  it('nao navega se havia overlay mesmo quando nenhum listener fecha o dialogo', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    document.body.innerHTML = '<section role="dialog"></section>';
    const router = {
      currentRoute: { value: { path: '/transactions' } },
      back: vi.fn(),
    };
    const { installAndroidBackHandler } = await import('./mobile');
    installAndroidBackHandler(router as never);
    const handler = mocked.addListener.mock.calls[0][1];

    handler({ canGoBack: true });

    expect(router.back).not.toHaveBeenCalled();
    expect(mocked.exitApp).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('nao navega quando popstate de modal acabou de consumir o Back Android', async () => {
    mocked.native = true;
    mocked.platform = 'android';
    (
      globalThis as typeof globalThis & { __plannerfinSuppressNextAndroidBack?: number }
    ).__plannerfinSuppressNextAndroidBack = Date.now() + 1000;
    const router = {
      currentRoute: { value: { path: '/transactions' } },
      back: vi.fn(),
    };
    const { installAndroidBackHandler } = await import('./mobile');
    installAndroidBackHandler(router as never);
    const handler = mocked.addListener.mock.calls[0][1];

    handler({ canGoBack: true });

    expect(router.back).not.toHaveBeenCalled();
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
