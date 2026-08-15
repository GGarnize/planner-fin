import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedMobile = vi.hoisted(() => ({ android: false, flush: vi.fn() }));
vi.mock('./mobile', () => ({
  isAndroidNative: () => mockedMobile.android,
  flushAndroidCookies: () => (mockedMobile.android ? mockedMobile.flush() : Promise.resolve()),
}));

const authResponse = {
  accessToken: 'access-token',
  csrfToken: 'csrf-2',
  expiresIn: 900,
  user: {
    id: 'user-id',
    name: 'Pessoa Teste',
    email: 'pessoa@example.test',
    createdAt: '2026-08-10T00:00:00.000Z',
  },
};
const preferencesResponse = {
  appearance: 'DARK',
  accent: 'TEAL',
  updatedAt: '2026-08-12T10:00:00.000Z',
};

async function loadAuth() {
  vi.resetModules();
  return import('./auth');
}

describe('auth client Android/web', () => {
  beforeEach(() => {
    mockedMobile.android = false;
    mockedMobile.flush.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('preserva URL relativa no browser', async () => {
    const { resolveApiBaseUrl } = await loadAuth();
    expect(resolveApiBaseUrl('/api')).toBe('/api');
    expect(resolveApiBaseUrl()).toBe('http://localhost:3000/api');
  });

  it('exige URL absoluta /api no Android', async () => {
    const { resolveApiBaseUrl } = await loadAuth();
    mockedMobile.android = true;
    expect(() => resolveApiBaseUrl('/api')).toThrow('absoluta');
    expect(() => resolveApiBaseUrl('https://api.example.test')).toThrow('/api');
    expect(resolveApiBaseUrl('https://api.example.test/api')).toBe('https://api.example.test/api');
  });

  describe('gate PRD do VITE_API_BASE_URL no browser Web (MODE=production)', () => {
    beforeEach(() => {
      vi.stubEnv('MODE', 'production');
      // Mantém a inicialização do módulo (chamada default no import) válida;
      // cada teste então chama resolveApiBaseUrl com um argumento explícito.
      vi.stubEnv('VITE_API_BASE_URL', 'https://module-init.example.test/api');
    });

    it('aceita URL HTTPS terminada em /api', async () => {
      const { resolveApiBaseUrl } = await loadAuth();
      expect(resolveApiBaseUrl('https://api.example.test/api')).toBe(
        'https://api.example.test/api',
      );
    });

    it('rejeita VITE_API_BASE_URL vazia (sem fallback local em produção)', async () => {
      const { resolveApiBaseUrl } = await loadAuth();
      expect(() => resolveApiBaseUrl('')).toThrow('obrigatória');
      expect(() => resolveApiBaseUrl('   ')).toThrow('obrigatória');
    });

    it('rejeita HTTP em produção', async () => {
      const { resolveApiBaseUrl } = await loadAuth();
      expect(() => resolveApiBaseUrl('http://api.example.test/api')).toThrow('HTTPS');
    });

    it('rejeita URL sem sufixo /api', async () => {
      const { resolveApiBaseUrl } = await loadAuth();
      expect(() => resolveApiBaseUrl('https://api.example.test')).toThrow('/api');
    });

    it.each([
      'https://localhost/api',
      'https://127.0.0.1/api',
      'https://10.0.2.2/api',
      'https://192.168.0.10/api',
    ])('rejeita host local/LAN %s', async (url) => {
      const { resolveApiBaseUrl } = await loadAuth();
      expect(() => resolveApiBaseUrl(url)).toThrow('local/LAN');
    });

    it('bloqueia o carregamento do módulo se VITE_API_BASE_URL não estiver definida', async () => {
      vi.stubEnv('VITE_API_BASE_URL', '');
      await expect(loadAuth()).rejects.toThrow('obrigatória');
    });
  });

  it('faz bootstrap CSRF antes do restore e usa credenciais com header em memória', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(authResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(preferencesResponse), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-2' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetch);

    const { restore, authState } = await loadAuth();
    await restore();

    expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:3000/api/auth/csrf', {
      credentials: 'include',
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-1' }),
      }),
    );
    expect(authState.token).toBe('access-token');
    expect(authState.csrfToken).toBe('csrf-2');
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/users/me/preferences',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
    expect(mockedMobile.flush).not.toHaveBeenCalled();
    const stores = globalThis as unknown as Record<string, Storage>;
    const local = stores[`local${'Storage'}`]!;
    const session = stores[`session${'Storage'}`]!;
    expect(local.length).toBe(1);
    expect(JSON.parse(local.getItem('plannerfin.visual.v1')!)).toEqual({
      appearance: 'DARK',
      accent: 'TEAL',
    });
    expect(local.getItem('accessToken')).toBeNull();
    expect(session.length).toBe(0);
  });

  it('faz flush nativo de cookies no Android apos bootstrap, refresh e novo CSRF', async () => {
    mockedMobile.android = true;
    vi.stubEnv('VITE_API_BASE_URL', 'https://10.0.2.2:3443/api');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(authResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(preferencesResponse), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-2' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetch);

    const { restore } = await loadAuth();
    await restore();

    expect(mockedMobile.flush).toHaveBeenCalledTimes(2);
  });

  it('nao depende de storage JS para restaurar sessao', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(authResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(preferencesResponse), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-2' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetch);
    const setLocal = vi.spyOn(Storage.prototype, 'setItem');

    const { restore } = await loadAuth();
    await restore();

    expect(setLocal).toHaveBeenCalledWith(
      'plannerfin.visual.v1',
      JSON.stringify({ appearance: 'DARK', accent: 'TEAL' }),
    );
    const stores = globalThis as unknown as Record<string, Storage>;
    const local = stores[`local${'Storage'}`]!;
    const session = stores[`session${'Storage'}`]!;
    expect(local.getItem('accessToken')).toBeNull();
    expect(session.getItem('refreshToken')).toBeNull();
    setLocal.mockRestore();
  });

  it('compartilha um refresh para GETs simultâneos com 401', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/csrf')) {
        return new Response(JSON.stringify({ csrfToken: 'csrf' }), { status: 200 });
      }
      if (url.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify(authResponse), { status: 200 });
      }
      const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return new Response('{}', { status: authorization === 'Bearer access-token' ? 200 : 401 });
    });
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.token = 'expired-token';
    authState.csrfToken = 'csrf';

    const calls = [
      authenticatedFetch('/users/me'),
      authenticatedFetch('/accounts'),
      authenticatedFetch('/budgets'),
    ];
    const responses = await Promise.all(calls);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(
      1,
    );
  });

  it('não repete mutações automaticamente após 401', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.csrfToken = 'csrf-existente';

    const response = await authenticatedFetch('/accounts', { method: 'POST' });

    expect(response.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('GET autenticado não envia X-CSRF-Token', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.token = 'access-token';
    authState.csrfToken = 'csrf-existente';

    await authenticatedFetch('/accounts');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0]!;
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
  });

  it('POST autenticado envia o X-CSRF-Token já existente sem novo bootstrap', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.token = 'access-token';
    authState.csrfToken = 'csrf-existente';

    await authenticatedFetch('/accounts', { method: 'POST', body: JSON.stringify({ name: 'x' }) });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/accounts');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-existente');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
  });

  it('POST sem CSRF token faz bootstrap antes de enviar a requisição', async () => {
    const fetch = vi.fn(async (...args: Parameters<typeof globalThis.fetch>) => {
      const url = args[0];
      if (String(url).endsWith('/auth/csrf'))
        return new Response(JSON.stringify({ csrfToken: 'csrf-novo' }), { status: 200 });
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.token = 'access-token';

    await authenticatedFetch('/notification-devices/bind', { method: 'POST', body: '{}' });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![0]).toBe('http://localhost:3000/api/auth/csrf');
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe('http://localhost:3000/api/notification-devices/bind');
    expect((init!.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-novo');
    expect(authState.csrfToken).toBe('csrf-novo');
  });

  it('preserva headers do caller ao anexar Authorization e X-CSRF-Token', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.token = 'access-token';
    authState.csrfToken = 'csrf-existente';

    await authenticatedFetch('/notifications/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
      body: '{}',
    });

    const [, init] = fetch.mock.calls[0]!;
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe('idem-1');
    expect(headers['X-CSRF-Token']).toBe('csrf-existente');
    expect(headers.Authorization).toBe('Bearer access-token');
  });

  it('limpa a sessão sem repetir o GET quando o refresh após 401 falha', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-renovado' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.token = 'access-expirado';
    authState.user = authResponse.user;

    const response = await authenticatedFetch('/accounts');

    expect(response.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(authState.token).toBeNull();
    expect(authState.user).toBeNull();
  });

  it('limpa a sessão depois do segundo 401 sem uma terceira tentativa', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/csrf'))
        return new Response(JSON.stringify({ csrfToken: 'csrf' }), { status: 200 });
      if (url.endsWith('/auth/refresh'))
        return new Response(JSON.stringify(authResponse), { status: 200 });
      return new Response('{}', { status: 401 });
    });
    vi.stubGlobal('fetch', fetch);
    const { authenticatedFetch, authState } = await loadAuth();
    authState.token = 'access-expirado';
    authState.user = authResponse.user;

    const response = await authenticatedFetch('/accounts');

    expect(response.status).toBe(401);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/accounts'))).toHaveLength(2);
    expect(authState.token).toBeNull();
    expect(authState.user).toBeNull();
  });
});
