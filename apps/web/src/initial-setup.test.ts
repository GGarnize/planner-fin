import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  fetch: vi.fn(),
  state: {
    token: 'access',
    csrfToken: 'csrf',
    user: {
      id: 'user-a',
      name: 'Pessoa',
      email: 'pessoa@example.test',
      createdAt: '2026-08-13T00:00:00.000Z',
    },
    restoring: false,
    error: '',
  },
}));

vi.mock('./auth', () => ({
  authState: authMock.state,
  authenticatedFetch: authMock.fetch,
}));

async function loadSetup() {
  vi.resetModules();
  return import('./initial-setup');
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200 });
}

describe('initial setup idempotency key', () => {
  beforeEach(() => {
    authMock.fetch.mockReset();
    authMock.state.user = {
      id: 'user-a',
      name: 'Pessoa',
      email: 'pessoa@example.test',
      createdAt: '2026-08-13T00:00:00.000Z',
    };
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
        .mockReturnValueOnce('22222222-2222-4222-8222-222222222222'),
    });
  });

  it('reutiliza a mesma Idempotency-Key quando a resposta da confirmacao se perde', async () => {
    const { setupState, previewInitialSetup, confirmInitialSetup } = await loadSetup();
    setupState.data = { draftVersion: 1 } as never;
    authMock.fetch
      .mockResolvedValueOnce(ok({ previewToken: 'preview-1', draftVersion: 1, summary: {} }))
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(ok({ status: 'COMPLETED', created: {}, counts: {} }))
      .mockResolvedValueOnce(ok({ status: 'COMPLETED' }));

    await previewInitialSetup();
    await expect(confirmInitialSetup()).rejects.toThrow('response lost');
    await confirmInitialSetup();

    const confirmCalls = authMock.fetch.mock.calls.filter(
      ([path]) => path === '/users/me/setup/confirm',
    );
    expect(confirmCalls).toHaveLength(2);
    expect(
      confirmCalls.map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']),
    ).toEqual(['11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111']);
  });

  it('gera nova Idempotency-Key quando novo preview e gerado', async () => {
    const { setupState, previewInitialSetup, confirmInitialSetup } = await loadSetup();
    setupState.data = { draftVersion: 1 } as never;
    authMock.fetch
      .mockResolvedValueOnce(ok({ previewToken: 'preview-1', draftVersion: 1, summary: {} }))
      .mockRejectedValueOnce(new TypeError('lost-1'))
      .mockResolvedValueOnce(ok({ previewToken: 'preview-2', draftVersion: 1, summary: {} }))
      .mockRejectedValueOnce(new TypeError('lost-2'));

    await previewInitialSetup();
    await expect(confirmInitialSetup()).rejects.toThrow('lost-1');
    await previewInitialSetup();
    await expect(confirmInitialSetup()).rejects.toThrow('lost-2');

    const keys = authMock.fetch.mock.calls
      .filter(([path]) => path === '/users/me/setup/confirm')
      .map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']);
    expect(keys).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });
});
